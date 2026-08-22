/**
 * Skills Tab — 多根聚合列表 + frontmatter 开关（热生效）+ SKILL.md 编辑-保存
 * P1-3 约定：开关 = SKILL.md frontmatter 的 disable-model-invocation /
 * user-invocable；写操作仅限 writable 根（user-dsh）。
 * 发哥指令：不做新增（skill 子目录/脚本多，新增不好操作）；SKILL.md 必须可编辑-保存。
 */
import React, { useEffect, useState } from "react"
import { confirmDialog, errText, rpc } from "./rpc.js"
import { Button, Drawer, ErrorBar, Field } from "./ui.jsx"

const ROOT_LABEL = {
  "project-dsh": "项目 .dsh",
  "project-agents": "项目 .agents",
  "user-dsh": "用户 ~/.dsh",
  "user-agents": "~/.agents",
}

export function SkillsTab() {
  const [skills, setSkills] = useState(null)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // {skill}
  const [busyId, setBusyId] = useState(null)

  async function refresh() {
    try {
      const r = await rpc("listSkills")
      setSkills(r.skills ?? [])
      setError(null)
    } catch (e) {
      setError(errText(e))
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function toggleFlag(skill, which) {
    setBusyId(skill.id + which)
    try {
      await rpc("setSkillFlags", {
        rootId: skill.rootId,
        id: skill.id,
        source: skill.source,
        ...(which === "model" ? { modelVisible: !skill.modelVisible } : {}),
        ...(which === "user" ? { userInvocable: !skill.userInvocable } : {}),
      })
      await refresh()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusyId(null)
    }
  }

  async function del(skill) {
    if (
      !(await confirmDialog(
        `删除 Skill「${skill.id}」（${skill.path}）？该目录将被递归删除且不可恢复。`,
      ))
    )
      return
    setBusyId(skill.id + "del")
    try {
      await rpc("removeSkill", { rootId: skill.rootId, id: skill.id, source: skill.source })
      await refresh()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <ErrorBar message={error} />
      <div className="cc-row-actions" style={{ margin: "4px 0 10px" }}>
        <span className="cc-card-sub">
          开关与 SKILL.md 编辑均由 watcher 热生效；新增请在磁盘创建目录后点「刷新」。
        </span>
        <Button onClick={refresh}>刷新</Button>
      </div>
      {!skills ? null : skills.length === 0 ? (
        <p className="cc-empty">所有技能根均为空。</p>
      ) : (
        <table className="cc-table">
          <thead>
            <tr>
              <th>id</th>
              <th>来源根</th>
              <th>模型可见</th>
              <th>用户可调</th>
              <th>描述</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={`${s.rootId}/${s.id}`} className={s.broken ? "cc-tr-disabled" : undefined}>
                <td>{s.id}{s.broken ? <span className="cc-badge cc-badge-warn" style={{ marginLeft: 6 }}>broken</span> : null}</td>
                <td>
                  <span className={"cc-badge " + (s.rootWritable ? "cc-badge-ok" : "cc-badge-muted")}>
                    {ROOT_LABEL[s.rootId] ?? s.rootId} · rank{s.rank}
                  </span>
                </td>
                <td>
                  <Button disabled={!s.rootWritable || busyId === s.id + "model"} onClick={() => toggleFlag(s, "model")}>
                    {s.modelVisible ? "可见" : "隐藏"}
                  </Button>
                </td>
                <td>
                  <Button disabled={!s.rootWritable || busyId === s.id + "user"} onClick={() => toggleFlag(s, "user")}>
                    {s.userInvocable ? "可调" : "禁调"}
                  </Button>
                </td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description ?? "—"}</td>
                <td>
                  <div className="cc-row-actions">
                    <Button onClick={() => setEditing({ skill: s })}>编辑</Button>
                    {s.rootWritable ? (
                      <Button kind="danger" disabled={busyId === s.id + "del"} onClick={() => del(s)}>
                        删除
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing ? (
        <SkillFileEditor
          skill={editing.skill}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

/** SKILL.md 编辑-保存抽屉：全文 textarea + hash 围栏 + 只读根只读展示 */
function SkillFileEditor({ skill, onClose, onSaved }) {
  const [state, setState] = useState({ loading: true, content: "", hash: "", path: "", error: null })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState(null)

  useEffect(() => {
    let alive = true
    rpc("readSkillFile", { rootId: skill.rootId, id: skill.id, source: skill.source })
      .then((r) => {
        if (!alive) return
        setState({ loading: false, content: r.content ?? "", hash: r.hash ?? "", path: r.path ?? "", error: null })
      })
      .catch((e) => {
        if (!alive) return
        setState({ loading: false, content: "", hash: "", path: "", error: errText(e) })
      })
    return () => {
      alive = false
    }
  }, [])

  async function save() {
    setSaving(true)
    setSaveErr(null)
    try {
      const r = await rpc("writeSkillFile", {
        rootId: skill.rootId,
        id: skill.id,
        source: skill.source,
        content: state.content,
        expectedHash: state.hash,
      })
      setState((s) => ({ ...s, hash: r.hash }))
      setDirty(false)
      onSaved?.()
    } catch (e) {
      setSaveErr(errText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      title={`编辑 ${skill.id} — SKILL.md`}
      onClose={onClose}
      footer={
        <>
          <ErrorBar message={saveErr} />
          <span className="cc-hint" style={{ marginRight: "auto" }}>
            {state.loading ? "" : dirty ? "有未保存改动 · " : "已保存 · "}watcher 热生效
          </span>
          <Button onClick={onClose}>{dirty ? "取消" : "关闭"}</Button>
          <Button kind="primary" disabled={!dirty || saving || state.loading || !!state.error} onClick={save}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </>
      }
    >
      {state.loading ? (
        <p className="cc-empty">加载中…</p>
      ) : state.error ? (
        <ErrorBar message={state.error} />
      ) : (
        <>
          <Field label={state.path} hint="frontmatter 与正文均可编辑；保存即热生效">
            <textarea
              className="cc-textarea"
              style={{ minHeight: 420, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 12.5 }}
              value={state.content}
              spellCheck={false}
              readOnly={!skill.rootWritable}
              onChange={(e) => {
                setState((s) => ({ ...s, content: e.target.value }))
                setDirty(true)
              }}
            />
          </Field>
          {!skill.rootWritable ? (
            <p className="cc-warnbar">该技能位于只读根（{ROOT_LABEL[skill.rootId] ?? skill.rootId}），仅可查看。</p>
          ) : null}
        </>
      )}
    </Drawer>
  )
}
