/**
 * mcp-supervisor — mcp-center settings → dsh-mcp-client 动态挂载
 *
 * 职责（DESIGN.md §4.1）：
 *  - scope.watch(next) 触发 rebuild：diff 出 toAdd/toRemove/toUpdate
 *  - 挂载：ctx.isolate('mcp') realm 下 ctx.plugin(dshMcpClient, config)，serverName 唯一
 *  - 状态上报：tools/change 扫描 `mcp__<serverName>__` 前缀计数 + fiber settle 结果
 *  - teardown：fiber.dispose()（dsh-mcp-client 的 effect 清理注销工具并断连）
 *
 * 零侵入：不修改 dsh 源码；dsh-mcp-client 以依赖形式整体复用。
 */
import { McpCenterSchema, validateMcpDoc } from "./mcp-schema.js"

/** 由 settings entry 构造 dsh-mcp-client config（剥 enabled，补 serverName） */
export function buildClientConfig(serverName, entry) {
  const { enabled, ...rest } = entry ?? {}
  return {
    ...rest,
    serverName,
    transport: rest.transport === "streamable-http" ? "streamable-http" : "stdio",
  }
}

/** 配置快照比较键（resolved 实值；host 侧无脱敏问题） */
function configKey(entry) {
  return JSON.stringify(entry)
}

/**
 * 创建 supervisor。
 * @param ctx - 插件 context（需可 ctx.isolate / ctx.plugin / ctx.get('tools') / ctx.on）
 * @param logger - ctx.logger
 * @returns {{ rebuild, statusList, testMcp, dispose }}
 */
export function createSupervisor(ctx, logger) {
  /** serverName -> { fiber, configKey } */
  const live = new Map()
  /** serverName -> { state: 'connecting'|'connected'|'error'|'disabled', tools, error?, since } */
  const status = new Map()
  let disposed = false
  /** rebuild 串行队列（防 watch 高频触发时 teardown/mount 交错） */
  let rebuildQueue = Promise.resolve()
  /** 已请求但尚未被队列消费的最新文档（合并突发写入） */
  let pendingDoc
  let draining = false

  function setState(name, patch) {
    const prev = status.get(name) ?? { state: "connecting", tools: 0, since: Date.now() }
    status.set(name, { ...prev, ...patch, since: prev.since ?? Date.now() })
  }

  async function teardown(name) {
    const rec = live.get(name)
    if (!rec) return
    live.delete(name)
    try {
      await rec.fiber.dispose()
    } catch (err) {
      logger.warn("config-center: teardown %s failed:", name, err?.message ?? err)
    }
    setState(name, { state: "connecting", tools: 0 })
  }

  function mount(name, entry) {
    const config = buildClientConfig(name, entry)
    // isolate('mcp') realm：同 label join 同一 scope，服务不进 root realm
    const scoped = ctx.isolate("mcp")
    // dsh-mcp-client 为外部包：host 半纯 ESM 直载，Node 从嵌套 node_modules 解析
    import("@deepseek-ai/dsh-mcp-client")
      .then((mod) => {
        if (disposed) return
        const f = scoped.plugin(
          { name: `config-center/mcp-${name}`, inject: mod.inject ?? [], apply: mod.apply },
          config,
        )
        live.set(name, { fiber: f, configKey: configKey(entry) })
        setState(name, { state: "connecting", tools: 0 })
        Promise.resolve(f).then(
          () => refreshCounts(),
          (err) => {
            logger.warn("config-center: mount %s failed:", name, err?.message ?? err)
            setState(name, { state: "error", error: String(err?.message ?? err) })
          },
        )
      })
      .catch((err) => {
        logger.warn("config-center: cannot load @deepseek-ai/dsh-mcp-client:", err?.message ?? err)
        setState(name, { state: "error", error: "dsh-mcp-client unavailable: " + String(err?.message ?? err) })
      })
  }

  /** 扫描 tools registry，按 `mcp__<server>__` 前缀更新工具计数 */
  function refreshCounts() {
    const tools = ctx.get("tools")
    if (tools === undefined) return
    let schemas
    try {
      schemas = tools.schemas()
    } catch {
      return
    }
    const counts = new Map()
    for (const name of live.keys()) counts.set(name, 0)
    for (const s of schemas) {
      const toolName = s?.name ?? ""
      for (const sn of counts.keys()) {
        // publicToolName = mcp__<serverName>__<rawName>；serverName 可能含下划线，
        // 必须按完整前缀匹配而非 split
        if (toolName.startsWith(`mcp__${sn}__`)) {
          counts.set(sn, counts.get(sn) + 1)
          break
        }
      }
    }
    for (const [name, n] of counts) {
      const st = status.get(name)
      if (st?.state === "error") continue // 错误态保持，等下次挂载结果覆盖
      setState(name, { state: n > 0 ? "connected" : "connecting", tools: n })
    }
  }

  /**
   * diff 重建（串行化 + 突发合并）：desired = enabled 条目。
   * 配置变化的条目 teardown 后重挂。多次并发调用合并为一次排队执行，
   * 队列只消费最新文档 —— 永不交错。
   * @param {Record<string, unknown>} next resolved section（含 secret 实值）
   */
  function rebuild(next) {
    if (disposed) return Promise.resolve()
    pendingDoc = next
    if (draining) return rebuildQueue
    draining = true
    rebuildQueue = rebuildQueue.then(async () => {
      while (!disposed && pendingDoc !== undefined) {
        const doc = pendingDoc
        pendingDoc = undefined
        try {
          await applyRebuild(doc)
        } catch (err) {
          logger.warn("config-center: mcp rebuild failed:", err?.message ?? err)
        }
      }
      draining = false
    })
    return rebuildQueue
  }

  async function applyRebuild(next) {
    const desired = new Map()
    for (const [key, entry] of Object.entries(next ?? {})) {
      if (entry?.enabled === false) {
        setState(key, { state: "disabled", tools: 0 })
        continue
      }
      desired.set(key, entry)
    }
    for (const [name] of [...live]) {
      if (!desired.has(name)) await teardown(name)
    }
    for (const [name, entry] of desired) {
      const rec = live.get(name)
      if (rec && rec.configKey === configKey(entry)) continue
      if (rec) await teardown(name)
      mount(name, entry)
    }
    // 文档中已消失的条目：清理状态，避免 statusList 回显幽灵行
    for (const name of [...status.keys()]) {
      if (!(name in (next ?? {}))) status.delete(name)
    }
    refreshCounts()
  }

  /**
   * 探活：临时 MCP client 连接并列出工具，60s 超时。
   * @param {{transport:'stdio'|'streamable-http', command?, args?, env?, cwd?, url?, headers?}} candidate
   * @returns {{ok:true, tools:number, sample:string[]} | {ok:false, error:string}}
   */
  async function testMcp(candidate) {
    const problem = validateMcpDoc({ probe: { ...candidate, enabled: true } }) // 复用跨字段校验
    if (problem && !/server name/.test(problem)) return { ok: false, error: problem }
    let Client, StdioClientTransport, StreamableHTTPClientTransport
    try {
      const sdk = await import("@modelcontextprotocol/sdk/client/index.js")
      const types = await import("@modelcontextprotocol/sdk/types.js")
      const stdio = await import("@modelcontextprotocol/sdk/client/stdio.js")
      const http = await import("@modelcontextprotocol/sdk/client/streamableHttp.js")
      Client = sdk.Client
      void types
      StdioClientTransport = stdio.StdioClientTransport
      StreamableHTTPClientTransport = http.StreamableHTTPClientTransport
    } catch (err) {
      return { ok: false, error: "MCP SDK unavailable: " + String(err?.message ?? err) }
    }
    const transport =
      candidate.transport === "streamable-http"
        ? new StreamableHTTPClientTransport(new URL(candidate.url), {
            requestInit: { headers: candidate.headers ?? {} },
          })
        : new StdioClientTransport({
            command: candidate.command,
            args: candidate.args ?? [],
            env: { ...(candidate.env ?? {}) },
            ...(candidate.cwd ? { cwd: candidate.cwd } : {}),
          })
    const client = new Client({ name: "dsh-config-center-probe", version: "0.1.0" })
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("probe timeout (60s)")), 60000))
    try {
      await Promise.race([client.connect(transport), timeout])
      const res = await Promise.race([client.listTools(), timeout])
      const names = (res?.tools ?? []).map((t) => t.name)
      return { ok: true, tools: names.length, sample: names.slice(0, 10) }
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err) }
    } finally {
      try {
        await client.close()
      } catch {}
    }
  }

  /** UI 徽标数据源：合并文档 enabled 与实时状态 */
  function statusList(doc) {
    const out = []
    for (const [name, entry] of Object.entries(doc ?? {})) {
      const st = status.get(name) ?? { state: entry?.enabled === false ? "disabled" : "connecting", tools: 0 }
      out.push({
        serverName: name,
        transport: entry?.transport,
        enabled: entry?.enabled !== false,
        state: entry?.enabled === false ? "disabled" : st.state,
        tools: st.tools ?? 0,
        ...(st.error ? { error: st.error } : {}),
      })
    }
    for (const [name, st] of status) {
      if (!(name in (doc ?? {}))) out.push({ serverName: name, enabled: false, state: st.state, tools: st.tools ?? 0 })
    }
    return out
  }

  async function dispose() {
    disposed = true
    pendingDoc = undefined
    for (const [name] of [...live]) await teardown(name)
    status.clear()
  }

  // 工具注册表变化 → 刷新计数（含 dsh-mcp-client 注册/注销与重同步）
  ctx.effect(() => ctx.on("tools/change", () => refreshCounts()), "config-center: watch tools/change")

  return { rebuild, statusList, testMcp, dispose, refreshCounts }
}
