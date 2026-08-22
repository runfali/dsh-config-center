/**
 * dsh-config-center — 扩展中心 浏览器半边
 *
 * 设置 → 「扩展中心」独立页（settings.section），内部三 Tabs：
 *   Plugins | Skills | MCP
 * 数据通道：fetch('/api/config-center/<method>') 同源 JSON RPC（见 src/index.js）。
 * MCP 只读快照走 ctx.settingsScope.bind({namespace:'mcp-center'})；写路径全部走
 * mcpMutate pathOp RPC（P0-2，防 redact 抹密钥）。
 */
import type {} from "@deepseek-ai/dsh-client-locale/client"
import type {} from "@deepseek-ai/dsh-client-ui-settings/client"
import React, { useState } from "react"
import { createRoot } from "react-dom/client"

/** 客户端所需服务：slots 注册 section、settingsScope 读 mcp-center 快照 */
export const inject = ["slots", "locale", "settingsScope"]

// ---------------------------------------------------------------- rpc 工具

async function rpc(method, args) {
  const res = await fetch(`/api/config-center/${method}`, {
    method: args === undefined ? "GET" : "POST",
    headers: args === undefined ? undefined : { "content-type": "application/json" },
    body: args === undefined ? undefined : JSON.stringify(args),
  })
  let body = null
  try {
    body = await res.json()
  } catch {}
  if (!res.ok || !body?.ok) {
    throw new Error(body?.error ?? `rpc ${method} failed (${res.status})`)
  }
  return body
}

// ---------------------------------------------------------------- 样式

const CSS = `
.cc-section{max-width:860px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
.cc-heading{margin:0;font-size:18px;font-weight:600}
.cc-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px}
.cc-tabs{display:flex;gap:22px;align-items:flex-end;border-bottom:1px solid var(--dsw-alias-border-l2)}
.cc-tab{background:none;border:0;cursor:pointer;font:inherit;color:var(--dsw-alias-label-tertiary);padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.cc-tab[data-active="true"]{color:var(--dsw-alias-label-primary)}
.cc-tab[data-active="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-primary)}
.cc-panel{padding-top:8px;min-width:0}
.cc-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;margin:0}
`

function injectCss() {
  if (typeof document === "undefined") return
  const TAG_ID = "dsh-config-center/css"
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`)) return
  const tag = document.createElement("style")
  tag.dataset.plugin = "dsh-config-center"
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

// ---------------------------------------------------------------- Tab 壳（T6 起逐个填充）

function Placeholder({ name }: { name: string }) {
  return <p className="cc-empty">{name} 功能建设中（当前为 T1 骨架占位）</p>
}

type TabId = "plugins" | "skills" | "mcp"

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "plugins", label: "插件" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
]

function ConfigCenterSection() {
  const [active, setActive] = useState<TabId>("mcp")
  return (
    <div className="cc-section">
      <h2 className="cc-heading">扩展中心</h2>
      <p className="cc-intro">统一管理插件、Skill 与 MCP 服务器。插件改动需重启 Profile 生效；Skill 与 MCP 即时生效。</p>
      <div className="cc-tabs" role="tablist">
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
      <div className="cc-panel" role="tabpanel">
        {active === "plugins" && <Placeholder name="插件管理" />}
        {active === "skills" && <Placeholder name="Skills 管理" />}
        {active === "mcp" && <Placeholder name="MCP 服务器" />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 入口

export function apply(ctx: any) {
  injectCss()
  // ping 通道自检（控制台可见结果；失败不影响页面）
  rpc("ping")
    .then((r) => console.info("[config-center] host channel ok:", r))
    .catch((err) => console.warn("[config-center] host channel unreachable:", err))

  const slots = ctx.get("slots")
  if (slots === undefined) return
  slots.inject("settings.section", () =>
    slots.register(
      { name: "settings.section", id: "config-center", order: 30, label: "扩展中心" },
      (props: any) => <ConfigCenterSection close={props.close} />,
    ),
  )
}
