/** 共享 UI 原语：字段、徽标、按钮、抽屉（对齐官方 fields.module.css 视觉） */
import React, { useState } from "react"

export function Field({ label, hint = undefined, invalid = undefined, invalidText = undefined, children }) {
  return (
    <div className="cc-field">
      <div className="cc-field-head">
        <label className="cc-label">{label}</label>
      </div>
      {children}
      <p className={invalid ? "cc-invalid" : "cc-hint"}>{invalid ? invalidText || "invalid" : hint || ""}</p>
    </div>
  )
}

export function TextInput({ value, onChange, placeholder = undefined, invalid = undefined, type = "text" }) {
  return (
    <input
      className={"cc-input" + (invalid ? " cc-input-invalid" : "")}
      type={type}
      value={value ?? ""}
      placeholder={placeholder ?? ""}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

const STATE_BADGE = {
  connected: { text: "已连接", cls: "ok" },
  connecting: { text: "连接中", cls: "muted" },
  error: { text: "错误", cls: "err" },
  disabled: { text: "已停用", cls: "muted" },
}

export function StatusBadge({ state, tools }) {
  const s = STATE_BADGE[state] ?? { text: state, cls: "muted" }
  return (
    <span className={`cc-badge cc-badge-${s.cls}`}>
      {s.text}
      {state === "connected" && tools > 0 ? ` · ${tools} 工具` : ""}
    </span>
  )
}

export function Button({ kind = "secondary", disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      className={`cc-btn cc-btn-${kind}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** 右侧抽屉：编辑表单容器 */
export function Drawer({ title, onClose, children, footer }) {
  if (!title) return null
  return (
    <div className="cc-drawer-mask" onClick={onClose}>
      <div className="cc-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="cc-drawer-head">
          <span className="cc-drawer-title">{title}</span>
          <Button onClick={onClose}>关闭</Button>
        </div>
        <div className="cc-drawer-body">{children}</div>
        {footer ? <div className="cc-drawer-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

/** 行内错误条 */
export function ErrorBar({ message }) {
  if (!message) return null
  return (
    <p className="cc-errorbar" role="alert">
      {message}
    </p>
  )
}

/** 加载态 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: false, data: null, error: null })
  const reload = async () => {
    setState({ loading: true, data: null, error: null })
    try {
      const data = await fn()
      setState({ loading: false, data, error: null })
    } catch (e) {
      setState({ loading: false, data: null, error: e })
    }
  }
  React.useEffect(() => {
    reload()
  }, deps)
  return { ...state, reload }
}
