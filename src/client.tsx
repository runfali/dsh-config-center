/**
 * dsh-config-center — 扩展中心 浏览器半边
 *
 * 主界面直达（发哥指令）：左侧栏底部 Settings 旁的「扩展管理中心」入口
 * （sidebar.footer.action，与 Cordis 面板同款官方挂点）→ 点击在 shell.overlay
 * 打开全屏管理页；不再注册 settings.section（设置弹窗内样式不协调）。
 *
 * 数据通道：fetch('/api/config-center/<method>') 同源 JSON RPC。
 * MCP 只读快照走 ctx.settingsScope.bind({namespace:'mcp-center'})；写路径全部走
 * mcpMutate pathOp RPC（P0-2，防 redact 抹密钥）。
 */
import type {} from "@deepseek-ai/dsh-client-locale/client"
import React, { useEffect, useState } from "react"
import { McpTab } from "./client/McpTab.tsx"
import { PluginsTab } from "./client/PluginsTab.tsx"
import { SkillsTab } from "./client/SkillsTab.tsx"
import { injectCss } from "./client/style.js"

/** 客户端所需服务 */
export const inject = ["slots", "settingsScope"]

// ---------------------------------------------------------------- 全局开合 store

/** 模块级开合状态（footer 按钮 ↔ shell.overlay 面板的共享源） */
const overlayStore = {
  open: false,
  listeners: new Set(),
  getSnapshot() {
    return this.open
  },
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  },
  setOpen(v) {
    if (this.open === v) return
    this.open = v
    this.listeners.forEach((fn) => fn())
  },
}

function useOverlayOpen() {
  const [open, setOpen] = useState(() => overlayStore.getSnapshot())
  useEffect(() => overlayStore.subscribe(() => setOpen(overlayStore.getSnapshot())), [])
  return [open, (v) => overlayStore.setOpen(v)]
}

// ---------------------------------------------------------------- 侧栏入口（Settings 旁）

/** 图标：积木拼图（自绘 SVG，对齐官方 16px outline 视觉） */
function ExtensionsIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M6.2 1.8h3.1v2.1a1.35 1.35 0 1 0 2.7 0V1.8h2.2v3.1h-2.1a1.35 1.35 0 1 0 0 2.7h2.1v3.1h-2.1a1.35 1.35 0 1 0 0 2.7h2.1v3.6H1.7V1.8h4.5z" strokeLinejoin="round" />
    </svg>
  )
}

/** 侧栏底部入口行（样式对齐 settings.trigger：wide=图标+文字，rail=仅图标） */
function FooterEntry({ wide }) {
  const [, setOpen] = useOverlayOpen()
  return (
    <button
      type="button"
      className={"cc-foot-entry" + (wide ? " is-wide" : "")}
      title="扩展管理中心"
      onClick={() => setOpen(true)}
    >
      <ExtensionsIcon size={wide ? 16 : 18} />
      {wide ? <span className="cc-foot-label">扩展管理中心</span> : null}
    </button>
  )
}

// ---------------------------------------------------------------- 全屏管理页

const TABS = [
  { id: "plugins", label: "插件" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
]

function ManagerPage({ scope, onClose }) {
  const [active, setActive] = useState("plugins")
  const [needsRestart, setNeedsRestart] = useState(false)
  const [commentLost, setCommentLost] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="cc-page">
      <header className="cc-page-head">
        <div className="cc-page-title">
          <ExtensionsIcon size={18} />
          <h1>扩展管理中心</h1>
        </div>
        <div className="cc-tabs cc-tabs-page" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="cc-tab"
              data-active={tab.id === active ? "true" : undefined}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button" className="cc-page-close" title="关闭 (Esc)" onClick={onClose}>
          ✕
        </button>
      </header>
      <main className="cc-page-body">
        {needsRestart || commentLost ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {commentLost ? (
              <div className="cc-warnbar" role="status">
                <span>本次写入未保留 patch 文件中/尾部注释（头部注释已保留），原文备份于 cordis.patch.yml.bak。</span>
              </div>
            ) : null}
            {needsRestart ? (
              <div className="cc-warnbar" role="status">
                <span>配置已写入 — 重启 Profile 后生效：</span>
                <code>dsh --profile web 重启</code>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="cc-section cc-section-page">
          {active === "plugins" && (
            <PluginsTab onNeedsRestart={() => setNeedsRestart(true)} onCommentLost={() => setCommentLost(true)} />
          )}
          {active === "skills" && <SkillsTab />}
          {active === "mcp" && <McpTab scope={scope} />}
        </div>
      </main>
    </div>
  )
}

/** shell.overlay 常驻占位：open 才渲染全屏页 */
function OverlayHost({ scope }) {
  const [open] = useOverlayOpen()
  if (!open) return null
  return <ManagerPage scope={scope} onClose={() => overlayStore.setOpen(false)} />
}

// ---------------------------------------------------------------- 入口

export function apply(ctx) {
  injectCss()
  const slots = ctx.get("slots")
  if (slots === undefined) return
  // MCP 只读快照：绑定到本插件 fiber（dispose 随 fiber 回收）
  let scope = null
  try {
    scope = ctx.settingsScope?.bind ? ctx.settingsScope.bind({ namespace: "mcp-center" }) : null
  } catch {}

  // 侧栏底部入口（Settings 旁）
  slots.inject("sidebar.footer.action", () =>
    slots.register({ name: "sidebar.footer.action", id: "config-center-entry", order: 10 }, FooterEntry),
  )
  // 全屏管理页（frame-wide 浮层）
  slots.inject("shell.overlay", () =>
    slots.register({ name: "shell.overlay", id: "config-center-page", order: 50 }, OverlayHost),
  )
}
