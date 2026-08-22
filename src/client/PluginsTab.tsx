/**
 * Plugins Tab — cordis.patch.yml 逻辑行的增删改查
 * 数据源 listRows（含 contentHash 围栏）；写操作 addRow/updateRow/removeRow/
 * toggleRow/writePatch 全部携带 expectedHash；保存成功提示重启（文件行不热生效）。
 */
import React, { useEffect, useState } from "react"
import { confirmDialog, errText, rpc } from "./rpc.js"
import { Button, Drawer, ErrorBar, Field, TextInput } from "./ui.jsx"

const SOURCE_LABEL = { direct: "patch 直挂", insert: "insert 块", group: "group 子行" }

export function PluginsTab({ onNeedsRestart }) {
  const [doc, setDoc] = useState(null) // {flat, contentHash, patchPath}
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)

  async function refresh() {
    try {
      const d = await rpc("listRows")
      setDoc(d)
      setError(null)
    } catch (e) {
      setError(errText(e))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function writeOp(method, args) {
    try {
      if (!doc) throw new Error("列表尚未加载完成，请稍候再操作")
      await rpc(method, { ...args, expectedHash: doc.contentHash })
      await refresh()
      onNeedsRestart?.()
      return true
    } catch (e) {
      setError(errText(e))
      return false
    }
  }

  async function del(row) {
    if (!(await confirmDialog(`删除插件「${row.id}」（${row.name}）？将改写 cordis.patch.yml，重启 Profile 后生效。`))) return
    await writeOp("removeRow", { id: row.id })
  }

  async function toggle(row) {
    await writeOp("toggleRow", { id: row.id, disabled: !(row.disabled === true) })
  }

  return (
    <div>
      <ErrorBar message={error} />
      <div className="cc-row-actions" style={{ margin: "4px 0 10px" }}>
        <span className="cc-card-sub">写入 {doc?.patchPath ?? "cordis.patch.yml"} · 改动需重启 Profile 生效</span>
        <Button kind="primary" onClick={() => setCreating(true)}>
          新增插件
        </Button>
      </div>
      {!doc ? null : doc.flat.length === 0 ? (
        <p className="cc-empty">当前 patch 文件没有任何插件行。</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th>来源</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {doc.flat.map((row) => {
              const disabled = row.disabled === true
              return (
                <tr key={row.id} className={disabled ? "cc-tr-disabled" : undefined}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className="cc-badge cc-badge-muted">{SOURCE_LABEL[row.source] ?? row.source}{row.groupId ? ` · ${row.groupId}` : ""}</span>
                  </td>
                  <td>
                    {disabled ? (
                      <span className="cc-badge cc-badge-muted">已禁用</span>
                    ) : (
                      <span className="cc-badge cc-badge-ok">启用</span>
                    )}
                  </td>
                  <td>
                    <div className="cc-row-actions">
                      <Button onClick={() => setEditing(row)}>编辑</Button>
                      <Button onClick={() => toggle(row)}>{disabled ? "启用" : "禁用"}</Button>
                      <Button kind="danger" onClick={() => del(row)}>
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {creating ? (
        <RowEditor
          title="新增插件"
          initial={{ id: "", name: "", configText: "{}", disabled: false }}
          onClose={() => setCreating(false)}
          onSave={async (draft) => {
            let config
            try {
              config = JSON.parse(draft.configText || "{}")
            } catch {
              throw new Error("config 不是合法 JSON")
            }
            const ok = await writeOp("addRow", { row: { id: draft.id, name: draft.name, config, ...(draft.disabled ? { disabled: true } : {}) } })
            if (ok) setCreating(false)
          }}
        />
      ) : null}

      {editing ? (
        <RowEditor
          title={`编辑 ${editing.id}`}
          initial={{
            id: editing.id,
            name: editing.name,
            configText: JSON.stringify(editing.config ?? {}, null, 2),
            disabled: editing.disabled === true,
          }}
          onClose={() => setEditing(null)}
          onSave={async (draft) => {
            let config
            try {
              config = JSON.parse(draft.configText || "{}")
            } catch {
              throw new Error("config 不是合法 JSON")
            }
            const ok = await writeOp("updateRow", { id: editing.id, patch: { name: draft.name, config } })
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
      footer={
        <>
          <ErrorBar message={err} />
          <Button onClick={onClose}>取消</Button>
          <Button
            kind="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                await onSave(draft)
              } catch (e) {
                setErr(errText(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "保存中…" : "保存"}
          </Button>
        </>
      }
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
      <label className="cc-check">
        <input type="checkbox" checked={draft.disabled} onChange={(e) => setDraft((d) => ({ ...d, disabled: e.target.checked }))} />
        禁用该插件（保留配置）
      </label>
    </Drawer>
  )
}
