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
import { settingsNamespace } from "@deepseek-ai/dsh-settings"
import { McpCenterSchema, validateMcpDoc } from "./mcp-schema.js"

export { McpCenterSchema, validateMcpDoc, McpEntrySchema, SERVER_NAME_PATTERN } from "./mcp-schema.js"

export const name = "config-center"
export const inject = ["webServer", "settings"]
/** settings namespace：MCP server 配置（T2） */
export const MCP_SETTINGS_NS = settingsNamespace("mcp-center")

export const Config = z.object({
  /** cordis.patch.yml 绝对路径；空 = 从 profile 目录自动解析 */
  patchPath: z.string().default(""),
  /** 可写技能根目录；空 = <DSH_HOME>/skills */
  skillsRoot: z.string().default(""),
  /** patch 文件读取字节上限 */
  maxPatchBytes: z.number().default(1048576),
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

  // ---- T2: mcp-center settings namespace（live；watch 在 T3 接 rebuild）----
  ctx.inject(["settings"], (c) => {
    const scope = c.settings.register(MCP_SETTINGS_NS, McpCenterSchema, {
      applies: "live",
      // 跨字段校验：dict key 即 serverName，schema 无法表达 key 约束
      validate: (value) => {
        const problem = validateMcpDoc(value)
        if (problem) throw new Error(problem)
      },
    })
    ctx.effect(
      () =>
        scope.watch((next, prev) => {
          // T3 将在此触发 isolate 子树 diff 重建
          ctx.logger.info(
            "config-center: mcp-center section changed (%s -> %s entries)",
            Object.keys(prev ?? {}).length,
            Object.keys(next ?? {}).length,
          )
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
    return () =>
      handlers.forEach((fn) => {
        try {
          fn()
        } catch {}
      })
  }, "dsh-config-center: /api/config-center/* routes")

  ctx.logger.info("config-center host half applied (skeleton T1)")
}
