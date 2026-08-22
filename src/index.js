/**
 * dsh-config-center — 扩展中心 Host 半边
 *
 * 设计要点：
 *  - 零侵入：不改 dsh 核心源码；路由 / 设置页 / 动态 MCP 挂载全走 Cordis 插件 API
 *  - Client→Host 通道：ctx.webServer.register({kind,path,handler}) 注册
 *    /api/config-center/* JSON 端点（dsh-paperclip 生产先例），客户端 fetch 同源直达
 *  - apply 必须同步；启动期 IO 用同步版本
 *
 * 分阶段实现（见 DESIGN.md 头部总表）：
 *  T1 骨架：ping 端点（通道验证）
 *  T2 mcp-center settings namespace + schema
 *  T3 isolate 动态挂载 dsh-mcp-client + rebuild + testMcp + 状态上报
 *  T4 文件 RPC：listRows/addRow/removeRow/updateRow/toggleRow/writePatch
 *  T5 Skills RPC：listSkills/setSkillFlags/removeSkill/createSkillFromTemplate
 */
import z from "@deepseek-ai/schemastery"
import os from "node:os"
import { settingsNamespace } from "@deepseek-ai/dsh-settings"
import { McpCenterSchema, validateMcpDoc } from "./mcp-schema.js"
import { createSupervisor } from "./mcp-supervisor.js"
import {
  addRow,
  readPatchDoc,
  removeRow,
  replaceRows,
  resolvePatchPath,
  serializeRows,
  toggleRow,
  updateRow,
  validateRows,
  writePatchAtomic,
} from "./patch-editor.js"
import { createSkillFromTemplate, listSkills, removeSkill, setSkillFlags, skillRoots } from "./skills-editor.js"

export { createSkillFromTemplate, listSkills, parseSkillMd, removeSkill, setSkillFlags, skillRoots } from "./skills-editor.js"

export { McpCenterSchema, validateMcpDoc, McpEntrySchema, SERVER_NAME_PATTERN } from "./mcp-schema.js"
export { buildClientConfig, createSupervisor } from "./mcp-supervisor.js"
export {
  addRow,
  containsJsTags,
  contentHash,
  readPatchDoc,
  removeRow,
  replaceRows,
  resolvePatchPath,
  serializeRows,
  toggleRow,
  updateRow,
  validateRows,
  writePatchAtomic,
} from "./patch-editor.js"

export const name = "config-center"
export const inject = ["webServer", "settings"]

/** patch 写操作串行队列（P2-7 并发保护的一半；另一半是 contentHash 围栏） */
let patchQueue = Promise.resolve()

/** 把一个写操作排进 patch 串行队列 */
function enqueuePatch(job) {
  const run = patchQueue.then(job, job)
  patchQueue = run.catch(() => {})
  return run
}
/** settings namespace：MCP server 配置（T2） */
export const MCP_SETTINGS_NS = settingsNamespace("mcp-center")

export const Config = z.object({
  /** cordis.patch.yml 绝对路径；空 = 从 profile 目录自动解析 */
  patchPath: z.string().default(""),
  /** 可写技能根目录；空 = <DSH_HOME>/skills */
  skillsRoot: z.string().default(""),
  /** patch 文件读取字节上限 */
  maxPatchBytes: z.number().default(1048576),
  /** 项目根（含 .git 的目录）；空 = 跳过 project 技能根扫描 */
  projectRoot: z.string().default(""),
  /** 额外自定义技能根（只读展示） */
  customSkillDirs: z.array(z.string()).default([]),
})

const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i

/**
 * 同源围栏（照抄 dsh-paperclip createUploadHandler 围栏段）：
 * 非 loopback Host 时要求 same-origin / same-site 或 origin 与 host 一致。
 * @returns {boolean} 是否放行
 */
export function guardSameOrigin(req) {
  const host = String(req.headers?.host ?? "")
  const origin = req.headers?.origin
  const secFetchSite = req.headers?.["sec-fetch-site"]
  const isLoopback = LOOPBACK_HOST.test(host)
  if (!isLoopback) {
    const isSameOrigin =
      secFetchSite === "same-origin" || secFetchSite === "none" || secFetchSite === "same-site"
    const originHostOk = (() => {
      if (!origin) return isSameOrigin
      try {
        const oh = new URL(origin).host
        return oh === host || LOOPBACK_HOST.test(oh)
      } catch {
        return false
      }
    })()
    if (!isSameOrigin && !originHostOk) return false
  }
  if (
    secFetchSite !== undefined &&
    secFetchSite !== "same-origin" &&
    secFetchSite !== "none" &&
    secFetchSite !== "same-site"
  ) {
    return false
  }
  return true
}

/**
 * JSON 响应工具
 */
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  res.end(JSON.stringify(body))
}

/**
 * 注册一个 /api/config-center/<method> exact 路由。
 * 统一围栏 + method 检查 + 异常捕获。
 */
function registerRpc(ctx, method, handler) {
  return ctx.webServer.register({
    kind: "exact",
    path: `/api/config-center/${method}`,
    handler: async (req, res) => {
      if (!guardSameOrigin(req)) {
        json(res, 403, { ok: false, error: "forbidden: cross-origin" })
        return
      }
      if (req.method !== "POST" && req.method !== "GET") {
        res.writeHead(405, { allow: "POST, GET" })
        res.end("method not allowed")
        return
      }
      let args = {}
      if (req.method === "POST") {
        const chunks = []
        let total = 0
        for await (const chunk of req) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          total += buf.length
          if (total > 4 * 1024 * 1024) {
            json(res, 413, { ok: false, error: "payload too large" })
            return
          }
          chunks.push(buf)
        }
        try {
          args = Buffer.concat(chunks).length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}
        } catch {
          json(res, 400, { ok: false, error: "invalid JSON body" })
          return
        }
        if (typeof args !== "object" || args === null || Array.isArray(args)) {
          json(res, 400, { ok: false, error: "body must be a JSON object" })
          return
        }
      }
      try {
        const result = await handler(args, req)
        json(res, 200, { ok: true, ...(result ?? {}) })
      } catch (err) {
        ctx.logger.warn("config-center rpc %s failed:", method, err?.message ?? err)
        json(res, err?.status ?? 500, { ok: false, error: String(err?.message ?? err) })
      }
    },
  })
}

export function apply(ctx, config) {
  let current = () => config
  /** mcp-center 能力面（inject settings 就绪后填充） */
  let mcpApi = null

  // ---- T2/T3: mcp-center settings namespace + 动态挂载 supervisor ----
  ctx.inject(["settings"], (c) => {
    const scope = c.settings.register(MCP_SETTINGS_NS, McpCenterSchema, {
      applies: "live",
      // 跨字段校验：dict key 即 serverName，schema 无法表达 key 约束
      validate: (value) => {
        const problem = validateMcpDoc(value)
        if (problem) throw new Error(problem)
      },
    })
    const supervisor = createSupervisor(ctx, ctx.logger)
    mcpApi = { statusList: () => supervisor.statusList(scope.get()), testMcp: (c2) => supervisor.testMcp(c2) }
    // dispose：随 fiber 拆掉全部子挂载与探针
    ctx.effect(() => supervisor.dispose(), "config-center: supervisor teardown")
    // 初始同步 + 后续变更重建（resolved 值含 secret 实值，直接透传 dsh-mcp-client）
    Promise.resolve(supervisor.rebuild(scope.get())).catch((err) =>
      ctx.logger.warn("config-center: initial mcp rebuild failed:", err?.message ?? err),
    )
    ctx.effect(
      () =>
        scope.watch((next) => {
          return supervisor.rebuild(next)
        }),
      "config-center: watch mcp-center",
    )
  })

  // ---- T4/T5 阶段在此挂 listRows/addRow/... RPC（骨架期仅 ping）----

  ctx.effect(() => {
    const handlers = []
    const reg = (method, handler) => handlers.push(registerRpc(ctx, method, handler))
    reg("ping", async () => ({
      name: "dsh-config-center",
      version: "0.1.0",
      ts: Date.now(),
      patchPath: current().patchPath,
    }))
    // T3：MCP 状态徽标数据源 + 探活
    reg("mcpStatus", async () => ({ servers: mcpApi ? mcpApi.statusList() : [], available: !!mcpApi }))
    reg("testMcp", async (args) => {
      if (!mcpApi) throw Object.assign(new Error("settings not ready"), { status: 503 })
      return mcpApi.testMcp(args?.candidate)
    })

    // ---- T4：cordis.patch.yml 行编辑 RPC ----
    const patchPath = () =>
      resolvePatchPath(current(), import.meta.url, process.env.DSH_HOME || `${os.homedir()}/.dsh`)
    /** 读 patch + 运行时 entries 快照 */
    reg("listRows", async () => {
      const p = patchPath()
      let doc
      try {
        doc = await readPatchDoc(p, current().maxPatchBytes)
      } catch (err) {
        if (err?.code === "ENOENT") doc = { raw: "[]\n", rows: [], hash: "" }
        else throw err
      }
      return { patchPath: p, rows: doc.rows, contentHash: doc.hash }
    })
    /** 行写操作公共壳：hash 围栏 → 操作 → 校验 → 原子写（串行队列） */
    const writeOp = (args, mutate) =>
      enqueuePatch(async () => {
        const expectedHash = args?.expectedHash ?? ""
        const doc = await readPatchDoc(patchPath(), current().maxPatchBytes).catch((err) => {
          if (err?.code === "ENOENT") return { raw: "[]\n", rows: [], hash: "" }
          throw err
        })
        if (expectedHash && expectedHash !== doc.hash) {
          throw Object.assign(new Error("patch file changed since you read it — refresh"), { status: 409 })
        }
        const nextRows = mutate(doc.rows)
        const problem = validateRows(nextRows)
        if (problem) throw Object.assign(new Error(problem), { status: 400 })
        await writePatchAtomic(patchPath(), serializeRows(nextRows))
        const after = await readPatchDoc(patchPath(), current().maxPatchBytes)
        return { needsRestart: true, rows: nextRows, contentHash: after.hash }
      })
    reg("addRow", async (args) => writeOp(args, (rows) => addRow(rows, args?.row)))
    reg("updateRow", async (args) => writeOp(args, (rows) => updateRow(rows, String(args?.id), args?.patch)))
    reg("removeRow", async (args) => writeOp(args, (rows) => removeRow(rows, String(args?.id))))
    reg("toggleRow", async (args) => writeOp(args, (rows) => toggleRow(rows, String(args?.id), !!args?.disabled)))
    reg("writePatch", async (args) => writeOp(args, (rows) => replaceRows(rows, args?.rows)))

    // ---- T5：Skills RPC ----
    const skillsRootsConfig = () => {
      const cfg = current()
      const roots = {
        dshHome: process.env.DSH_HOME || `${os.homedir()}/.dsh`,
        agentsHome: process.env.DSH_AGENTS_HOME || `${os.homedir()}/.agents`,
        projectRoot: cfg.projectRoot || "",
        customSkillDirs: Array.isArray(cfg.customSkillDirs) ? cfg.customSkillDirs : [],
      }
      return roots
    }
    /** 根定义；config.skillsRoot 覆盖默认 user-dsh 可写根 */
    const findRoot = (rootId) => {
      const all = skillRoots(skillsRootsConfig())
      const override = String(current().skillsRoot ?? "").trim()
      if (override && rootId === "user-dsh") {
        return { ...all.find((r) => r.id === "user-dsh"), root: override }
      }
      return all.find((r) => r.id === rootId)
    }
    reg("listSkills", async () => ({ skills: await listSkills(skillsRootsConfig()) }))
    reg("setSkillFlags", async (args) => {
      const root = findRoot(String(args?.rootId))
      if (!root) throw new Error(`unknown root "${args?.rootId}"`)
      return setSkillFlags(root, { id: String(args?.id), source: args?.source }, {
        modelVisible: args?.modelVisible,
        userInvocable: args?.userInvocable,
      })
    })
    reg("removeSkill", async (args) => {
      const root = findRoot(String(args?.rootId))
      if (!root) throw new Error(`unknown root "${args?.rootId}"`)
      return removeSkill(root, { id: String(args?.id), source: args?.source })
    })
    reg("createSkill", async (args) => {
      const root = findRoot(String(args?.rootId ?? "user-dsh"))
      if (!root) throw new Error(`unknown root "${args?.rootId}"`)
      return createSkillFromTemplate(
        { id: String(args?.id), description: args?.description, whenToUse: args?.whenToUse },
        root,
      )
    })
    return () =>
      handlers.forEach((fn) => {
        try {
          fn()
        } catch {}
      })
  }, "dsh-config-center: /api/config-center/* routes")

  ctx.logger.info("config-center host half applied (skeleton T1)")
}
