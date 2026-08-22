/**
 * mcp-center settings schema — dict<serverName, McpEntry>
 *
 * 审计约定（P0-2）：
 *  - env/headers 为 role('secret')，wire 面（describe redactSecrets:true）永不回传实值
 *  - 一切写路径走 ctx.settings.mutate(pathOps)，客户端禁止整条回写
 *  - enabled=false 条目 Host 不挂载但保留在文档中
 *
 * ⚠️ 建模约束（T2 实施中实测踩坑）：dsh-settings 的 redact walker 只下钻
 * object/dict/array 三种容器 —— 「secret buried inside a union branch is not
 * reachable and must not be modeled that way」（官方源码注释）。因此 stdio/http
 * 不能建成 union 分支，必须扁平为单 object，transport 差异由 validate() 兜底、
 * 由 UI 按 transport 显隐字段。
 */
import z from "@deepseek-ai/schemastery"

/** serverName 命名空间规则（对齐 dsh-mcp-client README） */
export const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/

/** 重连策略子对象（两种 transport 共用默认值） */
function reconnectSchema() {
  return z
    .object({
      enabled: z.boolean().default(true),
      initialDelayMs: z.number().min(0).default(500),
      maxDelayMs: z.number().min(100).default(30000),
      maxAttempts: z.number().min(1).default(10),
    })
    .role("collapse")
}

/** 单个 MCP server 条目（stdio 与 streamable-http 扁平合一，字段按 transport 取用） */
export const McpEntrySchema = z
  .object({
    transport: z.union([z.const("stdio"), z.const("streamable-http")]).required(),
    // ---- stdio 专用 ----
    command: z.string().default("").description("stdio：可执行文件，如 npx"),
    args: z.array(z.string()).default([]).description("stdio：命令参数"),
    /** 密钥环境变量；value 全部为 secret */
    env: z.dict(z.string().role("secret")).default({}).description("stdio：环境变量（值脱敏存储）"),
    cwd: z.string().default(""),
    // ---- streamable-http 专用 ----
    url: z.string().default("").description("http：MCP 端点 URL"),
    /** 认证头；value 全部为 secret */
    headers: z.dict(z.string().role("secret")).default({}).description("http：请求头（值脱敏存储）"),
    // ---- 公共 ----
    toolCallTimeoutMs: z.number().min(1000).max(600000).default(60000),
    failOnStartupError: z.boolean().default(false),
    reconnect: reconnectSchema(),
    enabled: z.boolean().default(true),
  })

/** mcp-center 整段 schema */
export const McpCenterSchema = z.dict(McpEntrySchema)

/**
 * 跨字段校验（schema 表达不了的）：
 *  - key 匹配 SERVER_NAME_PATTERN（dict key 即 serverName）
 *  - stdio ⇒ command 必填；streamable-http ⇒ url 必填
 * @param {{[k:string]:unknown}} doc 解析后的整段文档
 * @returns {string|null} 首个错误信息；null = 合法
 */
export function validateMcpDoc(doc) {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return "section must be an object"
  for (const [key, entry] of Object.entries(doc)) {
    if (!SERVER_NAME_PATTERN.test(key)) {
      return `server name "${key}" must match ${SERVER_NAME_PATTERN}`
    }
    if (typeof entry !== "object" || entry === null) return `"${key}" must be an object`
    if (entry.transport !== "stdio" && entry.transport !== "streamable-http") {
      return `"${key}".transport must be "stdio" or "streamable-http"`
    }
    if (entry.transport === "stdio") {
      if (typeof entry.command !== "string" || entry.command.trim() === "") {
        return `"${key}".command is required for stdio`
      }
    } else if (typeof entry.url !== "string" || entry.url.trim() === "") {
      return `"${key}".url is required for streamable-http`
    }
  }
  return null
}
