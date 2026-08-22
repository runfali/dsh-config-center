/**
 * Plugins Tab — 真正的插件管理：bundles（package.json）为主，patch 覆盖为辅
 * - Bundles：等价于 `dsh plugin --profile web add <spec>` / remove
 *   spec 支持三种形态（发哥原话）：
 *     dsh-better-sidebar@0.15.0
 *     /data/dsh-workspace/dsh-config-center
 *     github:HanaAyane/dsh-reasoning-effort
 * - Patch：cordis.patch.yml 的 insert/配置覆盖（modlens 等），保留原有增删改
 */
import React, { useEffect, useState } from "react"
import { confirmDialog, errText, rpc } from "./rpc.js"
import { Button, Drawer, ErrorBar, Field, TextInput } from "./ui.jsx"

const SOURCE_LABEL = { direct: "patch 直挂", insert: "insert 块", group: "group 子行" }

export function PluginsTab({ onNeedsRestart, onCommentLost }) {
  const [bundles, setBundles] = useState(null) // {profileDir, bundles:[{name,spec,inBox}]}
  const [doc, setDoc] = useState(null) // {flat, contentHash, patchPath}
  const [error, setError] = useState(null)
  const [spec, setSpec] = useState("")
  const [installing, setInstalling] = useState(false)
  const [editing, setEditing] = useState(null)
  const [creatingPatch, setCreatingPatch] = useState(false)

  async function refreshBundles() {
    try {
      const d = await rpc("listBundles")
      setBundles(d)
    } catch (e) { setError(errText(e)) }
  }
  async function refreshPatch() {
    try {
      const d = await rpc("listRows")
      setDoc(d)
    } catch (e) { setError(errText(e)) }
  }
  async function refreshAll() {
    setError(null)
    await Promise.all([refreshBundles(), refreshPatch()])
  }
  useEffect(() => { refreshAll() }, [])

  async function doInstall() {
    const s = spec.trim()
    if (!s) { setError("请输入插件地址（见下方示例）"); return }
    setInstalling(true); setError(null)
    try {
      await rpc("installBundle", { spec: s })
      setSpec("")
      await refreshBundles()
      onNeedsRestart?.()
    } catch (e) { setError(errText(e)) } finally { setInstalling(false) }
  }
  async function doRemoveBundle(name) {
    if (!(await confirmDialog(`移除插件「${name}」？将执行 pnpm remove 并从 bundles 中移除，重启后生效。`))) return
    setError(null)
    try {
      await rpc("removeBundle", { name })
      await refreshBundles()
      onNeedsRestart?.()
    } catch (e) { setError(errText(e)) }
  }

  async function writePatchOp(method, args) {
    try {
      if (!doc) throw new Error("patch 列表尚未加载完成")
      const resp = await rpc(method, { ...args, expectedHash: doc.contentHash })
      if (resp.commentLost) onCommentLost?.()
      await refreshPatch()
      onNeedsRestart?.()
      return true
    } catch (e) { setError(errText(e)); return false }
  }
  async function delPatch(row) {
    if (!(await confirmDialog(`删除配置覆盖「${row.id}」（${row.name}）？将改写 cordis.patch.yml，重启后生效。`))) return
    await writePatchOp("removeRow", { id: row.id })
  }
  async function togglePatch(row) {
    await writePatchOp("toggleRow", { id: row.id, disabled: !(row.disabled === true) })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <ErrorBar message={error} />

      {/* === Bundles：主列表 === */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>已安装插件</h3>
          <span className="cc-hint">{bundles ? `${bundles.bundles.length} 个 · ${bundles.profileDir}` : "加载中…"}</span>
        </div>

        {/* 安装表单：单字段 spec，示例即发哥三种写法 */}
        <div className="cc-card" style={{ marginBottom: 10 }}>
          <Field
            label="安装插件 — 填入与 CLI 相同的 <spec>"
            hint="支持三种写法，同 `dsh plugin --profile web add <spec>`"
          >
            <div style={{ display: "flex", gap: 8 }}>
              <TextInput
                value={spec}
                onChange={setSpec}
                placeholder="dsh-better-sidebar@0.15.0"
              />
              <Button kind="primary" disabled={installing} onClick={doInstall}>
                {installing ? "安装中…" : "安装"}
              </Button>
            </div>
          </Field>
          <div className="cc-hint" style={{ lineHeight: 1.6 }}>
            示例：<code>dsh-better-sidebar@0.15.0</code>（npm 带版本）<br />
            <code>/data/dsh-workspace/dsh-config-center</code>（本地绝对路径）<br />
            <code>github:HanaAyane/dsh-reasoning-effort</code>（GitHub，可加 #分支）
          </div>
        </div>

        {!bundles ? null : bundles.bundles.length === 0 ? (
          <p className="cc-empty">尚未安装任何 bundle 插件。</p>
        ) : (
          <table className="cc-table">
            <thead><tr><th>包名</th><th>来源 spec</th><th>操作</th></tr></thead>
            <tbody>
              {bundles.bundles.map((b) => (
                <tr key={b.name}>
                  <td><code>{b.name}</code>{b.inBox ? <span className="cc-badge cc-badge-muted" style={{ marginLeft: 6 }}>InBox</span> : null}</td>
                  <td style={{ fontSize: 12, color: "var(--dsw-alias-label-tertiary)" }}>{b.spec ?? "—"}</td>
                  <td>
                    {b.inBox ? <span className="cc-hint">内置</span> :
                      <Button kind="danger" onClick={() => doRemoveBundle(b.name)}>移除</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="cc-hint" style={{ marginTop: 6 }}>安装/移除后需重启 Profile 生效；InBox 为模版自带、不可移除。</p>
      </div>

      {/* === Patch 覆盖：次要，高级 === */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>配置覆盖</h3>
          <span className="cc-hint">{doc ? `${doc.flat.length} 条 · ${doc.patchPath}` : "加载中…"}</span>
          <span style={{ marginLeft: "auto" }}><Button onClick={() => setCreatingPatch(true)}>添加覆盖</Button></span>
        </div>
        {!doc ? null : doc.flat.length === 0 ? (
          <p className="cc-empty">当前 patch 文件没有任何覆盖行（仅 modlens 等会显示在此）。</p>
        ) : (
          <table className="cc-table">
            <thead><tr><th>id</th><th>name</th><th>来源</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {doc.flat.map((row) => {
                const disabled = row.disabled === true
                return (
                  <tr key={row.id} className={disabled ? "cc-tr-disabled" : undefined}>
                    <td>{row.id}</td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</td>
                    <td><span className="cc-badge cc-badge-muted">{SOURCE_LABEL[row.source] ?? row.source}{row.groupId ? ` · ${row.groupId}` : ""}</span></td>
                    <td>{disabled ? <span className="cc-badge cc-badge-muted">已禁用</span> : <span className="cc-badge cc-badge-ok">启用</span>}</td>
                    <td><div className="cc-row-actions">
                      <Button onClick={() => setEditing(row)}>编辑</Button>
                      <Button onClick={() => togglePatch(row)}>{disabled ? "启用" : "禁用"}</Button>
                      <Button kind="danger" onClick={() => delPatch(row)}>删除</Button>
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {creatingPatch ? (
        <RowEditor
          title="添加配置覆盖"
          initial={{ id: "", name: "", configText: "{}", disabled: false }}
          onClose={() => setCreatingPatch(false)}
          onSave={async (draft) => {
            let config; try { config = JSON.parse(draft.configText || "{}") } catch { throw new Error("config 不是合法 JSON") }
            const ok = await writePatchOp("addRow", { row: { id: draft.id, name: draft.name, config, ...(draft.disabled ? { disabled: true } : {}) } })
            if (ok) setCreatingPatch(false)
          }}
        />
      ) : null}
      {editing ? (
        <RowEditor
          title={`编辑 ${editing.id}`}
          initial={{ id: editing.id, name: editing.name, configText: JSON.stringify(editing.config ?? {}, null, 2), disabled: editing.disabled === true }}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            let config; try { config = JSON.parse(draft.configText || "{}") } catch { throw new Error("config 不是合法 JSON") }
            const ok = await writePatchOp("updateRow", { id: editing.id, patch: { name: draft.name, config } })
            if (ok) setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function RowEditor({ title, initial, onClose, onSave }) {
  const [draft, setDraft] = useState(initial)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const idInvalid = !/^[a-z0-9][a-z0-9-]*$/.test(draft.id)
  return (
    <Drawer
      title={title}
      onClose={onClose}
      footer={<><ErrorBar message={err} /><Button onClick={onClose}>取消</Button><Button kind="primary" disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { await onSave(draft) } catch (e) { setErr(errText(e)) } finally { setBusy(false) } }}>{busy ? "保存中…" : "保存"}</Button></>}
    >
      <Field label="id（唯一，[a-z0-9][a-z0-9-]*）" invalid={idInvalid} invalidText="id 格式不合法">
        <TextInput value={draft.id} onChange={(v) => setDraft((d) => ({ ...d, id: v }))} invalid={idInvalid} placeholder="my-plugin" />
      </Field>
      <Field label="name（npm 包名或绝对路径）">
        <TextInput value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="@scope/pkg 或 /abs/path/index.js" />
      </Field>
      <Field label="config（JSON）" hint="插件的组合配置；非法 JSON 无法保存">
        <textarea className={"cc-textarea"} value={draft.configText} onChange={(e) => setDraft((d) => ({ ...d, configText: e.target.value }))} spellCheck={false} />
      </Field>
      <label className="cc-check"><input type="checkbox" checked={draft.disabled} onChange={(e) => setDraft((d) => ({ ...d, disabled: e.target.checked }))} /> 禁用该项（保留配置）</label>
    </Drawer>
  )
}
