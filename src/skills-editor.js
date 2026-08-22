/**
 * skills-editor — Skill 发现与 frontmatter 开关（T5）
 *
 * 审计约定（P1-3）：skill 无 disabled 目录标记；启用/禁用 = SKILL.md frontmatter 的
 * disable-model-invocation / user-invocable 布尔位；watcher 热生效无需重启。
 *
 * 发现根（对齐 dsh-skill-filesystem rank 表，跳过缺失根与 .system 子目录）：
 *   100 project-dsh   <projectRoot>/.dsh/skills     （只读）
 *   200 project-agents <projectRoot>/.agents/skills （只读）
 *   300 custom        config.customSkillDirs         （只读）
 *   400 user-dsh      <dshHome>/skills               （可写）
 *   500 user-agents   <agentsHome>/skills            （只读）
 */
import { readFile, readdir, rm, stat, mkdir, writeFile } from "node:fs/promises"
import { realpath } from "node:fs/promises"
import { load as yamlLoad, dump as yamlDump } from "js-yaml"
import { join } from "node:path"

const SKILL_ID = /^[a-z0-9][a-z0-9-]*$/

/** 发现根定义 */
export function skillRoots({ dshHome, agentsHome, projectRoot, customSkillDirs }) {
  const roots = []
  if (projectRoot) {
    roots.push({ rank: 100, id: "project-dsh", root: join(projectRoot, ".dsh", "skills"), writable: false })
    roots.push({ rank: 200, id: "project-agents", root: join(projectRoot, ".agents", "skills"), writable: false })
  }
  for (const [i, dir] of (customSkillDirs ?? []).entries()) {
    roots.push({ rank: 300 + i, id: `custom-${i}`, root: dir, writable: false })
  }
  roots.push({ rank: 400, id: "user-dsh", root: join(dshHome, "skills"), writable: true })
  if (agentsHome) {
    roots.push({ rank: 500, id: "user-agents", root: join(agentsHome, "skills"), writable: false })
  }
  return roots
}

/** 解析 SKILL.md 文本 → {frontmatter, body, raw}；无 frontmatter 时 fm={} */
export function parseSkillMd(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!m) return { fm: {}, body: raw, hasFrontmatter: false }
  let fm = {}
  try {
    const parsed = yamlLoad(m[1])
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) fm = parsed
  } catch {}
  return { fm, body: raw.slice(m[0].length), hasFrontmatter: true }
}

/** 拼 frontmatter + 正文 */
export function renderSkillMd(fm, body) {
  return `---\n${yamlDump(fm, { lineWidth: -1 }).trimEnd()}\n---\n${body ?? ""}`
}

/** 布尔 frontmatter 位归一化（对齐 provider 失败默认拒绝语义） */
function toBool(v) {
  if (v === undefined || v === null) return undefined
  if (typeof v === "boolean") return v
  if (typeof v !== "string") return undefined
  const s = v.trim().toLowerCase()
  if (["true", "yes", "on", "1"].includes(s)) return true
  if (["false", "no", "off", "0"].includes(s)) return false
  return undefined // 驼峰/非法值交由 provider 警告剔除，这里视为未知
}

/**
 * 列出一个根下的全部 skill（目录 bundle `<name>/SKILL.md` 与平铺 `<name>.md`）。
 */
export async function scanRoot(rootSpec) {
  const out = []
  let names
  try {
    names = await readdir(rootSpec.root, { withFileTypes: true })
  } catch {
    return out // 根不存在是合法空态
  }
  for (const dirent of names.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const name = dirent.name
    if (name.startsWith(".")) continue
    if (dirent.isDirectory()) {
      const bundlePath = join(rootSpec.root, name, "SKILL.md")
      try {
        const st = await stat(bundlePath)
        if (st.isFile()) {
          out.push(buildRow(name, "bundle", bundlePath, parseSkillMd(await readFile(bundlePath, "utf8"))))
          continue
        }
      } catch {}
      // 目录但无 SKILL.md —— provider 不递归发现，报 broken 提示
      out.push({
        id: name,
        source: "unknown",
        path: join(rootSpec.root, name),
        modelVisible: true,
        userInvocable: true,
        broken: "directory without SKILL.md",
      })
      continue
    }
    if (dirent.isFile() && name.endsWith(".md")) {
      const flatPath = join(rootSpec.root, name)
      const id = name.slice(0, -3) || name
      try {
        out.push(buildRow(id, "flat", flatPath, parseSkillMd(await readFile(flatPath, "utf8"))))
        continue
      } catch {}
    }
    // 其他文件类型跳过（资源文件不构成 skill）
  }
  return out

  function buildRow(id, source, path, parsed) {
    const modelVisible = toBool(parsed.fm["disable-model-invocation"])
    const userInvocable = toBool(parsed.fm["user-invocable"])
    return {
      id,
      source,
      path,
      ...(typeof parsed.fm.name === "string" ? { name: parsed.fm.name } : {}),
      ...(typeof parsed.fm.description === "string" ? { description: parsed.fm.description } : {}),
      ...(typeof parsed.fm.whenToUse === "string" ? { whenToUse: parsed.fm.whenToUse } : {}),
      modelVisible: modelVisible !== true, // 默认可见
      userInvocable: userInvocable !== false, // 默认可调
      ...(modelVisible === undefined && parsed.hasFrontmatter && "disable-model-invocation" in parsed.fm ? { broken: "invalid boolean value" } : {}),
    }
  }
}

/** 全根聚合：listSkills RPC 数据源 */
export async function listSkills(rootsConfig) {
  const out = []
  for (const spec of skillRoots(rootsConfig)) {
    const items = await scanRoot(spec)
    for (const item of items) out.push({ ...item, rootId: spec.id, rank: spec.rank, rootWritable: spec.writable, root: spec.root })
  }
  return out
}

/**
 * 改一个 skill 的调用开关（仅限 writable 根内）。
 * @param {{root:string}} spec 目标根
 * @param {{id:string, source:'bundle'|'flat'}} target
 * @param {{modelVisible?:boolean, userInvocable?:boolean}} flags
 */
export async function setSkillFlags(spec, target, flags) {
  if (!spec.writable) throw new Error(`root "${spec.id}" is read-only`)
  const file = target.source === "bundle" ? join(spec.root, target.id, "SKILL.md") : join(spec.root, `${target.id}.md`)
  const confined = await ensureInside(spec.root, file)
  if (!confined) throw new Error("path escapes the skills root")
  let raw
  try {
    raw = await readFile(file, "utf8")
  } catch {
    throw new Error(`skill "${target.id}" not found under ${spec.id}`)
  }
  const parsed = parseSkillMd(raw)
  const fm = { ...parsed.fm }
  if (flags.modelVisible !== undefined) {
    if (flags.modelVisible) delete fm["disable-model-invocation"]
    else fm["disable-model-invocation"] = true
  }
  if (flags.userInvocable !== undefined) {
    if (flags.userInvocable) delete fm["user-invocable"]
    else fm["user-invocable"] = false
  }
  await writeFile(file, renderSkillMd(fm, parsed.body), { mode: 0o600 })
  return { ok: true }
}

/** realpath 后确认 child 严格位于 parent 内（删除防护） */
export async function ensureInside(parent, child) {
  try {
    const [rp, rc] = await Promise.all([realpath(parent), realpath(child)])
    return rc !== rp && rc.startsWith(rp + "/")
  } catch {
    return false
  }
}

/**
 * 删除 user 根内的 skill（目录或平铺文件），realpath 越界防护。
 */
export async function removeSkill(spec, target) {
  if (!spec.writable) throw new Error(`root "${spec.id}" is read-only`)
  const base = target.source === "bundle" ? join(spec.root, target.id) : join(spec.root, `${target.id}.md`)
  if (!(await ensureInside(spec.root, base))) throw new Error("path escapes the skills root")
  await rm(base, { recursive: true, force: true })
  return { ok: true }
}

/**
 * 模板新增：生成 <root>/<id>/SKILL.md 骨架。
 * @param {{id, description, whenToUse?}} spec
 */
export async function createSkillFromTemplate(spec, template) {
  if (!template.writable) throw new Error("the target root is read-only")
  if (!SKILL_ID.test(spec.id)) throw new Error(`skill id must match ${SKILL_ID}`)
  const dir = join(template.root, spec.id)
  if (!(await ensureExistsAndInside(template.root, dir))) throw new Error("path escapes the skills root")
  const fm = {
    name: spec.id,
    description: String(spec.description ?? "").trim(),
    ...(spec.whenToUse ? { whenToUse: String(spec.whenToUse).trim() } : {}),
  }
  if (!fm.description) throw new Error("description is required")
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, "SKILL.md"), renderSkillMd(fm, `\n${spec.id} 使用说明（模板骨架，请补充正文）。\n`), { mode: 0o600 })
  return { ok: true, path: join(dir, "SKILL.md") }
}

async function ensureExistsAndInside(parent, child) {
  try {
    const rp = await realpath(parent)
    const resolved = child.startsWith(parent) ? child : join(rp, child)
    return resolved.startsWith(rp + "/")
  } catch {
    return false
  }
}
