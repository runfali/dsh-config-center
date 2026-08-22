/**
 * patch-editor — cordis.patch.yml 结构感知行编辑纯函数集（T4）
 *
 * 文档模型（对齐 cordis-plugin-include applyEntryPatches 语义）：
 *  - 顶层列表元素两种：直接 entry {id,name,config,...} 或 patch 指令 {insert:[...]}
 *  - entry.group=true 时 config 为子 entry 数组（递归）
 *
 * 审计约定：
 *  - P1-4：含 !!js 表达式的内容拒绝 UI 写入（load→dump 会把动态求值语义变字面量）
 *  - P2-7：contentHash 修订围栏由调用方（index.js writeOp）执行
 *  - 原子写 tmp+rename + .bak 保留 + 权限 0600
 */
import yaml, { load } from "js-yaml"
import { entryListSchema } from "@deepseek-ai/cordis-plugin-include"
import { createHash } from "node:crypto"
import { chmod, copyFile, readFile, rename, writeFile } from "node:fs/promises"
import { existsSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"

const nodeFs = { readdirSync, existsSync }

/** 测试注入点：替换路径探测用的 fs 面 */
export function setFsProbe(fsImpl) {
  if (fsImpl === null) {
    nodeFs.readdirSync = readdirSync
    nodeFs.existsSync = existsSync
  } else {
    nodeFs.readdirSync = fsImpl.readdirSync
    nodeFs.existsSync = fsImpl.existsSync
  }
}

/** sha256 前 16 hex —— listRows 返回、写请求围栏 */
export function contentHash(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16)
}

// ---------------------------------------------------------------- 路径解析

/**
 * 解析 cordis.patch.yml 路径。
 * @param {{patchPath:string}} config 插件配置
 * @param {string} selfUrl import.meta.url（bundle 安装态位于 profiles/<n>/node_modules/<pkg>/...）
 * @param {string} dshHome DSH_HOME 绝对路径
 * @param {Record<string,string|undefined>} env 进程环境
 */
export function resolvePatchPath(config, selfUrl, dshHome, env = process.env) {
  if (config.patchPath && String(config.patchPath).trim() !== "") return String(config.patchPath)
  if (env.DSH_PROFILE) return join(dshHome, "profiles", env.DSH_PROFILE, "cordis.patch.yml")
  // bundle 安装态反推：<home>/profiles/<name>/node_modules/<pkg>/src/index.js
  const m = /^file:\/\/(.+)\/node_modules\/[^/]+\/(?:src|lib)\//.exec(selfUrl ?? "")
  if (m) {
    const decoded = decodeURIComponent(m[1])
    const mm = /^(.+)\/profiles\/([^/]+)$/.exec(decoded)
    if (mm) return join(mm[1], "profiles", mm[2], "cordis.patch.yml")
  }
  // 开发直挂态：profiles 下恰好一个候选才可自动判定
  try {
    const profilesDir = join(dshHome, "profiles")
    const candidates = nodeFs
      .readdirSync(profilesDir)
      .filter((n) => nodeFs.existsSync(join(profilesDir, n, "cordis.patch.yml")))
    if (candidates.length === 1) return join(profilesDir, candidates[0], "cordis.patch.yml")
    throw new Error(`candidates: ${candidates.join(", ") || "none"}`)
  } catch (err) {
    throw new Error(
      'config.patchPath is empty and the profile could not be auto-located (' +
        String(err?.message ?? err) +
        ') — set "patchPath" in the plugin config',
    )
  }
}

// ---------------------------------------------------------------- 读取与序列化

/** 读取并按 loader 方言解析 patch 文档 → {raw, rows, hash} */
export async function readPatchDoc(patchPath, maxBytes) {
  const buf = await readFile(patchPath)
  if (buf.length > maxBytes) throw new Error(`patch file exceeds ${maxBytes} bytes`)
  const raw = buf.toString("utf8")
  let rows
  try {
    rows = load(raw, { schema: entryListSchema })
  } catch (err) {
    throw new Error("patch file is not valid YAML: " + String(err?.message ?? err).split("\n")[0])
  }
  return { raw, rows: rows ?? [], hash: contentHash(buf) }
}

/** 序列化整表（loader 方言一致；!!js 已在 validate 阶段拦截）。
 *  注释保护：yaml.dump 无法保留注释 —— 原文件的头部连续注释块由调用方
 *  extractHeaderComments 提取后经 header 参数拼回；中/尾部注释无法定位回插，
 *  由 hasNonHeaderComments 检出并在 UI 警告「.bak 已保留原文」。 */
export function serializeRows(rows, header = "") {
  const body = yaml.dump(rows, { lineWidth: -1 })
  if (!header) return body
  return `${header.replace(/\n*$/, "")}\n\n${body}`
}

/** 提取文件头部连续注释块（含块内空行）；无则空串 */
export function extractHeaderComments(raw) {
  const lines = String(raw ?? "").split("\n")
  const head = []
  for (const line of lines) {
    if (/^\s*#/.test(line)) head.push(line)
    else if (line.trim() === "" && head.length > 0) head.push(line)
    else break
  }
  while (head.length > 0 && head[head.length - 1].trim() === "") head.pop()
  return head.join("\n")
}

/** 是否存在头部之外、UI 写入会丢失的注释 */
export function hasNonHeaderComments(raw) {
  const headerLines = new Set(extractHeaderComments(raw).split("\n"))
  let pastHeader = false
  for (const line of String(raw ?? "").split("\n")) {
    if (!pastHeader) {
      if (headerLines.has(line)) continue
      pastHeader = true
    }
    if (/^\s*#/.test(line)) return true
  }
  return false
}

/** 原子写入 + .bak 保留 + 权限收紧 */
export async function writePatchAtomic(patchPath, text) {
  const dir = dirname(patchPath)
  const tmp = join(dir, `.cordis.patch.${Date.now()}.tmp`)
  await writeFile(tmp, text, { mode: 0o600 })
  try {
    await copyFile(patchPath, `${patchPath}.bak`)
  } catch {}
  await rename(tmp, patchPath)
  await chmod(patchPath, 0o600).catch(() => {})
}

// ---------------------------------------------------------------- 结构遍历

/** 是否 patch 指令行（非逻辑 entry） */
function isInstruction(row) {
  return typeof row === "object" && row !== null && Array.isArray(row.insert)
}

/** 是否合法 entry id */
const ENTRY_ID = /^[a-z0-9][a-z0-9-]*$/
const ENTRY_FIELDS = ["id", "name", "config", "disabled", "group", "isolate"]

/**
 * 单个逻辑 entry 的 shape 校验。
 * 宽松模式（全表校验用）：loader 支持白名单之外的高级字段（inject/provide/
 * intercept...），round-trip 必须保真 —— 未知字段放行。
 */
function validateEntry(row, strict = false) {
  if (typeof row !== "object" || row === null || Array.isArray(row)) return "entry must be an object"
  if (typeof row.id !== "string" || !ENTRY_ID.test(row.id)) {
    return `entry id "${row?.id}" must match /^[a-z0-9][a-z0-9-]*$/`
  }
  if (typeof row.name !== "string" || row.name.trim() === "") return `entry "${row.id}" name is required`
  if (strict) {
    for (const key of Object.keys(row)) {
      if (!ENTRY_FIELDS.includes(key)) return `unknown field "${key}" in entry "${row.id}"`
    }
  }
  if (row.group && !Array.isArray(row.config)) return `group entry "${row.id}" must carry a config array`
  return null
}

/**
 * 扁平列出全部逻辑 entry（含容器引用，可原地修改/删除）。
 * depth 语义：0=顶层 direct，1=insert 组内，≥2=group 子级。
 * @returns {Array<{entry, source:'direct'|'insert'|'group', container, index, groupId?}>}
 */
export function listEntries(rows) {
  const out = []
  const walk = (list, depth, groupId) => {
    list.forEach((row, index) => {
      if (isInstruction(row)) {
        walk(row.insert, depth + 1, groupId)
        return
      }
      const source = depth === 0 ? "direct" : depth === 1 ? "insert" : "group"
      out.push({ entry: row, source, container: list, index, ...(groupId ? { groupId } : {}) })
      if (row && typeof row === "object" && row.group && Array.isArray(row.config)) {
        walk(row.config, depth + 2, row.id)
      }
    })
  }
  walk(rows ?? [], 0, null)
  return out
}

/** 整文档是否含不可安全往返的动态表达式（!!js / process.env 引用） */
export function containsJsTags(rows) {
  try {
    const text = yaml.dump(rows, { lineWidth: -1 })
    return /(^|\s)!!js/.test(text) || /process\.env\./.test(text)
  } catch {
    return true
  }
}

/** 全量校验：每个逻辑 entry shape（宽松）+ 全局 id 唯一 + 动态表达式检测 */
export function validateRows(rows) {
  if (!Array.isArray(rows)) return "document must be an array"
  const seen = new Set()
  for (const { entry } of listEntries(rows)) {
    const problem = validateEntry(entry)
    if (problem) return problem
    if (seen.has(entry.id)) return `duplicate entry id "${entry.id}"`
    seen.add(entry.id)
  }
  if (containsJsTags(rows)) return "document contains !!js dynamic expressions — edit those lines in the file directly"
  return null
}

// ---------------------------------------------------------------- 行操作

/** 新增：追加为一个独立 insert 指令块（loader 官方语义，不扰动既有结构）。
 *  UI 新增的行字段严格受限（防注入面）；全表校验走宽松模式保真既有高级字段。 */
export function addRow(rows, row) {
  const problem = validateEntry(row, true)
  if (problem) throw new Error(problem)
  if (containsJsTags([row])) throw new Error("row contains dynamic expressions — not allowed via UI")
  return [...(rows ?? []), { insert: [row] }]
}

/** 按 id 就地合并字段（id 不可变；跨 insert/group 定位） */
export function updateRow(rows, id, patch) {
  if (patch && "id" in patch && patch.id !== id) throw new Error("entry id is immutable")
  const hit = listEntries(rows).find((e) => e.entry.id === id)
  if (!hit) throw new Error(`no entry with id "${id}"`)
  Object.assign(hit.entry, { ...patch, id })
  return rows
}

/** 按 id 删除（从其真实容器 splice；清空 insert 指令块后移除空壳） */
export function removeRow(rows, id) {
  const hit = listEntries(rows).find((e) => e.entry.id === id)
  if (!hit) throw new Error(`no entry with id "${id}"`)
  hit.container.splice(hit.index, 1)
  for (let i = rows.length - 1; i >= 0; i--) {
    if (isInstruction(rows[i]) && rows[i].insert.length === 0) rows.splice(i, 1)
  }
  return rows
}

/** 启停开关（仅非 group entry） */
export function toggleRow(rows, id, disabled) {
  const hit = listEntries(rows).find((e) => e.entry.id === id)
  if (!hit) throw new Error(`no entry with id "${id}"`)
  if (hit.entry.group) throw new Error(`"${id}" is a group row; toggling applies to plugin rows only`)
  hit.entry.disabled = !!disabled
  return rows
}

/** 全量替换（重排/批量导入）：整表校验后整体采用 */
export function replaceRows(_rows, nextRows) {
  const problem = validateRows(nextRows)
  if (problem) throw new Error(problem)
  return nextRows
}
