/**
 * MCP Tab — mcp-center settings 的管理界面
 *
 * P0-2 约定：本组件对 settingsScope 只读（快照渲染）；一切写操作走
 * rpc('mcpMutate', {ops, expectedRevision})，客户端只提交变更字段的 pathOp，
 * Host 在含 secret 实值的原始 section 上合并 —— 整条回写被禁止。
 */
import React, { useEffect, useMemo, useState } from "react"
import { confirmDialog, errText, rpc } from "./rpc.js"
import { Button, Drawer, ErrorBar, Field, StatusBadge, TextInput } from "./ui.jsx"

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

/** 从快照构造 UI 模型 */
function docToServers(value) {
  const out = []
  for (const [serverName, entry] of Object.entries(value ?? {})) {
    out.push({ serverName, ...(typeof entry === "object" && entry !== null ? entry : {}) })
  }
  return out
}

export function McpTab({ scope }: { scope: any }) {
  const [servers, setServers] = useState([])
  const [statuses, setStatuses] = useState([])
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | {mode:'edit'|'create', draft}
  const [probeResult, setProbeResult] = useState(null)

  // settingsScope 只读快照驱动列表渲染；写路径全部走 mcpMutate
  useEffect(() => {
    if (!scope) return
    const adopt = () => setServers(docToServers(scope.getSnapshot().value))
    adopt()
    return scope.subscribe(adopt)
  }, [scope])

  async function refresh() {
    try {
      const st = await rpc("mcpStatus")
      setStatuses(st.servers ?? [])
      setError(null)
    } catch (e) {
      setError(errText(e))
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [])

  return (
    <div>
      <ErrorBar message={error} />
      <div className="cc-row-actions" style={{ margin: "4px 0 10px" }}>
        <span className="cc-card-sub">MCP 配置即时生效（live），无需重启。</span>
        <Button kind="primary" onClick={() => openCreate()}>
          新增服务器
        </Button>
      </div>
      {servers.length === 0 ? (
        <p className="cc-empty">尚未配置任何 MCP 服务器。点击「新增服务器」接入第一个 server。</p>
      ) : (
        servers.map((sv) => (
          <ServerCard
            key={sv.serverName}
            sv={sv}
            status={statuses.find((s) => s.serverName === sv.serverName)}
            onEdit={() => setEditing({ mode: "edit", draft: { ...sv } })}
            onToggle={() => toggle(sv)}
            onDelete={() => del(sv)}
            onProbe={() => probe(sv)}
            probeResult={probeResult?.serverName === sv.serverName ? probeResult : null}
          />
        ))
      )}
      {editing ? (
        <Editor
          editing={editing}
          existing={servers.map((s) => s.serverName)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )

  function openCreate() {
    setEditing({
      mode: "create",
      draft: { serverName: "", transport: "stdio", command: "", argsText: "", url: "", envPairs: [], headerPairs: [], enabled: true },
    })
  }

  async function mutate(ops) {
    await rpc("mcpMutate", { ops })
  }

  async function toggle(sv) {
    const next = !(sv.enabled !== false)
    if (
      next === false &&
      !(await confirmDialog(`停用 MCP 服务器「${sv.serverName}」？其工具将立即下线。`))
    )
      return
    try {
      await mutate([{ op: "set", path: [sv.serverName, "enabled"], value: next }])
      refresh()
    } catch (e) {
      setError(errText(e))
    }
  }

  async function del(sv) {
    if (!(await confirmDialog(`删除 MCP 服务器「${sv.serverName}」？此操作立即生效且不可撤销。`))) return
    try {
      await mutate([{ op: "unset", path: [sv.serverName] }])
      refresh()
    } catch (e) {
      setError(errText(e))
    }
  }

  async function probe(sv) {
    setProbeResult({ serverName: sv.serverName, loading: true })
    try {
      const candidate =
        sv.transport === "streamable-http"
          ? { transport: "streamable-http", url: sv.url ?? "", headers: {} }
          : { transport: "stdio", command: sv.command ?? "", args: sv.args ?? [] }
      const r = await rpc("testMcp", { candidate })
      setProbeResult({ serverName: sv.serverName, ...r })
    } catch (e) {
      setProbeResult({ serverName: sv.serverName, ok: false, error: errText(e) })
    }
  }
}

function ServerCard({ sv, status, onEdit, onToggle, onProbe, onDelete, probeResult }) {
  const enabled = sv.enabled !== false
  return (
    <div className={"cc-card" + (enabled ? "" : " cc-tr-disabled")}>
      <div className="cc-card-head">
        <span className="cc-card-title">{sv.serverName}</span>
        <StatusBadge state={status?.state ?? (enabled ? "connecting" : "disabled")} tools={status?.tools ?? 0} />
        <span className="cc-badge cc-badge-muted">{sv.transport === "streamable-http" ? "http" : "stdio"}</span>
        <div className="cc-row-actions">
          <Button onClick={onProbe}>探活</Button>
          <Button onClick={onEdit}>编辑</Button>
          <Button onClick={onToggle}>{enabled ? "停用" : "启用"}</Button>
          <Button kind="danger" onClick={onDelete}>
            删除
          </Button>
        </div>
      </div>
      <div className="cc-card-sub">
        {sv.transport === "streamable-http"
          ? sv.url
          : `${sv.command ?? ""} ${(sv.args ?? []).join(" ")}`}
        {probeResult ? (
          probeResult.loading ? (
            <span> · 探活中…</span>
          ) : probeResult.ok ? (
            <span style={{ color: "#2ea043" }}> · 探活成功：{probeResult.tools} 个工具{probeResult.sample?.length ? `（${probeResult.sample.join(", ")}…）` : ""}</span>
          ) : (
            <span style={{ color: "#f85149" }}> · 探活失败：{probeResult.error}</span>
          )
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 编辑抽屉

/** env/headers 的 KV 行编辑模型 ↔ pathOp 序列
 *  secret 安全语义（P0-2）：值留空且键已配置 = 保持存量实值不写；
 *  键被移除 = unset；新键或填了非空值 = set */
function pairsToOps(basePath, originalPairs, pairs, configuredKeys) {
  const ops = []
  for (const p of pairs) {
    const key = p.k.trim()
    if (!key) continue
    const isConfigured = configuredKeys.includes(key)
    if (isConfigured && (p.v ?? "") === "") continue // 留空 = 保持已存值
    ops.push({ op: "set", path: [...basePath, key], value: p.v ?? "" })
  }
  for (const orig of originalPairs) {
    if (!orig.k.trim()) continue
    const still = pairs.some((p) => p.k.trim() === orig.k.trim())
    if (!still && configuredKeys.includes(orig.k.trim())) {
      ops.push({ op: "unset", path: [...basePath, orig.k.trim()] })
    }
  }
  return ops
}

function Editor({ editing, existing, onClose, onSaved }) {
  const isNew = editing.mode === "create"
  const [draft, setDraft] = useState(() =>
    editing.mode === "edit"
      ? {
          ...editing.draft,
          argsText: (editing.draft.args ?? []).join(" "),
          envPairs: [],
          envConfigured: [], // 异步由 mcpSecrets 填充（redacted 视图不含键名）
          headerPairs: [],
          headerConfigured: [],
        }
      : editing.draft,
  )
  const [invalid, setInvalid] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  // 拉取该 server 已配置的 secret 键位目录（仅键名 + set 布尔，无实值）
  useEffect(() => {
    if (editing.mode !== "edit") return
    let alive = true
    rpc("mcpSecrets")
      .then(({ secrets }) => {
        if (!alive || !Array.isArray(secrets)) return
        const prefix = [editing.draft.serverName]
        const mine = secrets.filter((s) => s.path.length === prefix.length + 1 && s.path[0] === prefix[0])
        const envKeys = mine.filter((s) => s.path[1] === "env").map((s) => ({ key: s.path[2], set: s.set }))
        const headerKeys = mine.filter((s) => s.path[1] === "headers").map((s) => ({ key: s.path[2], set: s.set }))
        setDraft((d) => ({
          ...d,
          envPairs: envKeys.map(({ key }) => ({ k: key, v: "" })),
          envConfigured: envKeys.filter(({ set }) => set).map(({ key }) => key),
          headerPairs: headerKeys.map(({ key }) => ({ k: key, v: "" })),
          headerConfigured: headerKeys.filter(({ set }) => set).map(({ key }) => key),
        }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  async function save() {
    const problems = {}
    if (!SERVER_NAME_RE.test(draft.serverName)) problems.serverName = "需匹配 [A-Za-z0-9_-]{1,32}"
    else if (isNew && existing.includes(draft.serverName)) problems.serverName = "名称已存在"
    if (draft.transport === "stdio" && !String(draft.command ?? "").trim()) problems.command = "stdio 必须填写 command"
    if (draft.transport === "streamable-http" && !/^https?:\/\//.test(String(draft.url ?? "")))
      problems.url = "必须为 http(s):// URL"
    setInvalid(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    setErr(null)
    try {
      const args = String(draft.argsText ?? "")
        .split(/\s+/)
        .filter(Boolean)
      if (isNew) {
        const kvOf = (pairs) =>
          Object.fromEntries(
            pairs.filter((p) => p.k.trim() && (p.v ?? "") !== "").map((p) => [p.k.trim(), p.v]),
          )
        const entry =
          draft.transport === "streamable-http"
            ? { transport: "streamable-http", url: draft.url, headers: kvOf(draft.headerPairs), enabled: true }
            : {
                transport: "stdio",
                command: draft.command,
                args,
                env: kvOf(draft.envPairs),
                enabled: true,
              }
        // 新增：单条 set 整 entry（全新条目无 secret 保留问题）
        await rpc("mcpMutate", { ops: [{ op: "set", path: [draft.serverName], value: entry }] })
      } else {
        const name = draft.serverName
        const ops = [{ op: "set", path: [name, "transport"], value: draft.transport }]
        if (draft.transport === "stdio") {
          ops.push({ op: "set", path: [name, "command"], value: draft.command })
          ops.push({ op: "set", path: [name, "args"], value: args })
          ops.push(...pairsToOps([name, "env"], editing.draft.envPairs ?? [], draft.envPairs, editing.draft.envConfigured ?? []))
        } else {
          ops.push({ op: "set", path: [name, "url"], value: draft.url })
          ops.push(...pairsToOps([name, "headers"], editing.draft.headerPairs ?? [], draft.headerPairs, editing.draft.headerConfigured ?? []))
        }
        ops.push({ op: "set", path: [name, "enabled"], value: draft.enabled !== false })
        await rpc("mcpMutate", { ops })
      }
      onSaved()
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      title={isNew ? "新增 MCP 服务器" : `编辑 ${draft.serverName}`}
      onClose={onClose}
      footer={
        <>
          <ErrorBar message={err} />
          <Button disabled={busy} onClick={onClose}>
            取消
          </Button>
          <Button kind="primary" disabled={busy} onClick={save}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      <Field label="serverName（唯一标识，进入工具名 mcp__<name>__*）" hint="[A-Za-z0-9_-]{1,32}" invalid={!!invalid.serverName} invalidText={invalid.serverName}>
        <TextInput
          value={draft.serverName}
          onChange={(v) => set({ serverName: v })}
          invalid={!!invalid.serverName}
          placeholder="如 github / web-search"
        />
      </Field>
      <Field label="传输方式">
        <select className="cc-input" value={draft.transport} onChange={(e) => set({ transport: e.target.value })}>
          <option value="stdio">stdio（本地子进程）</option>
          <option value="streamable-http">streamable-http（远程服务）</option>
        </select>
      </Field>

      {draft.transport === "stdio" ? (
        <>
          <Field label="command" hint="可执行文件，如 npx / node / uvx" invalid={!!invalid.command} invalidText={invalid.command}>
            <TextInput value={draft.command ?? ""} onChange={(v) => set({ command: v })} invalid={!!invalid.command} placeholder="npx" />
          </Field>
          <Field label="args（空格分隔）" hint={'如 "-y @modelcontextprotocol/server-github"'}>
            <TextInput value={draft.argsText ?? ""} onChange={(v) => set({ argsText: v })} placeholder="-y @modelcontextprotocol/server-github" />
          </Field>
          <KVEditor
            label="env 环境变量（值脱敏存储）"
            pairs={draft.envPairs ?? []}
            configured={draft.envConfigured ?? []}
            onPairs={(envPairs) => set({ envPairs })}
            secret
          />
          <Field label="cwd（可选）">
            <TextInput value={draft.cwd ?? ""} onChange={(v) => set({ cwd: v })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="url" hint="MCP 端点地址" invalid={!!invalid.url} invalidText={invalid.url}>
            <TextInput value={draft.url ?? ""} onChange={(v) => set({ url: v })} invalid={!!invalid.url} placeholder="https://host/mcp" />
          </Field>
          <KVEditor
            label="headers 请求头（值脱敏存储）"
            pairs={draft.headerPairs ?? []}
            configured={draft.headerConfigured ?? []}
            onPairs={(headerPairs) => set({ headerPairs })}
            secret
          />
        </>
      )}
    </Drawer>
  )
}

function KVEditor({ label, pairs, configured, onPairs, secret }) {
  const update = (i, patch) => {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    onPairs(next)
  }
  return (
    <Field label={label} hint={secret ? "已配置的键留空即保持现值；填新值则覆盖" : undefined}>
      {pairs.length === 0 ? <span className="cc-hint">暂无条目</span> : null}
      {pairs.map((p, i) => {
        const isSet = configured.includes(p.k.trim()) && p.k.trim() !== ""
        return (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <TextInput value={p.k} onChange={(k) => update(i, { k })} placeholder="KEY" />
            <TextInput
              type="password"
              value={p.v}
              onChange={(v) => update(i, { v })}
              placeholder={isSet ? "已配置（留空保持）" : "VALUE"}
            />
            <Button onClick={() => onPairs(pairs.filter((_, idx) => idx !== i))}>移除</Button>
          </div>
        )
      })}
      <div>
        <Button onClick={() => onPairs([...pairs, { k: "", v: "" }])}>添加一项</Button>
      </div>
    </Field>
  )
}
