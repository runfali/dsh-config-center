/**
 * Skills Tab — 多根聚合列表 + frontmatter 开关（热生效）+ 模板新增
 * P1-3 约定：开关 = SKILL.md frontmatter 的 disable-model-invocation /
 * user-invocable；写操作仅限 writable 根（user-dsh）。
 */
import React, { useEffect, useState } from "react"
import { confirmDialog, errText, rpc } from "./rpc.js"
import { Button, Drawer, ErrorBar, Field, TextInput } from "./ui.jsx"

const ROOT_LABEL = {
  "project-dsh": "项目 .dsh",
  "project-agents": "项目 .agents",
  "user-dsh": "用户 ~/.dsh",
  "user-agents": "~/.agents",
}

export function SkillsTab() {
  const [skills, setSkills] = useState(null)
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)
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
        <span className="cc-card-sub">frontmatter 开关由 watcher 热生效，无需重启。</span>
        <Button kind="primary" onClick={() => setCreating(true)}>
          新增 Skill
        </Button>
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
                <td>{s.description ?? "—"}</td>
                <td>
                  {s.rootWritable ? (
                    <Button kind="danger" disabled={busyId === s.id + "del"} onClick={() => del(s)}>
                      删除
                    </Button>
                  ) : (
                    <span className="cc-hint">只读根</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating ? (
        <CreateDrawer
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateDrawer({ onClose, onSaved }) {
  const [draft, setDraft] = useState({ id: "", description: "", whenToUse: "" })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const idInvalid = !/^[a-z0-9][a-z0-9-]*$/.test(draft.id)

  return (
    <Drawer
      title="新增 Skill（模板骨架）"
      onClose={onClose}
      footer={
        <>
          <ErrorBar message={err} />
          <Button onClick={onClose}>取消</Button>
          <Button
            kind="primary"
            disabled={busy || idInvalid || !draft.description.trim()}
            onClick={async () => {
              setBusy(true)
              setErr(null)
              try {
                await rpc("createSkill", { ...draft, rootId: "user-dsh" })
                onSaved()
              } catch (e) {
                setErr(errText(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? "创建中…" : "创建"}
          </Button>
        </>
      }
    >
      <Field label="id（kebab-case，即目录名与 name）" invalid={idInvalid} invalidText="需匹配 ^[a-z0-9][a-z0-9-]*$">
        <TextInput value={draft.id} onChange={(v) => setDraft((d) => ({ ...d, id: v }))} invalid={idInvalid} placeholder="my-skill" />
      </Field>
      <Field label="description（必填）" hint="模型选择技能时依据的说明">
        <TextInput value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="做什么用的…" />
      </Field>
      <Field label="whenToUse（可选）" hint="何时使用的提示">
        <TextInput value={draft.whenToUse} onChange={(v) => setDraft((d) => ({ ...d, whenToUse: v }))} />
      </Field>
      <p className="cc-hint">创建后可在 ~/.dsh/skills/&lt;id&gt;/SKILL.md 中补充正文。</p>
    </Drawer>
  )
}
