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
import { McpTab } from "./client/McpTab.tsx"
import { PluginsTab } from "./client/PluginsTab.tsx"
import { SkillsTab } from "./client/SkillsTab.tsx"
import { CSS, injectCss } from "./client/style.js"

/** 客户端所需服务：slots 注册 section、settingsScope 读 mcp-center 快照 */
export const inject = ["slots", "settingsScope"]

type TabId = "plugins" | "skills" | "mcp"

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "plugins", label: "插件" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
]

function ConfigCenterSection({ scope }) {
  const [active, setActive] = useState<TabId>("plugins")
  const [needsRestart, setNeedsRestart] = useState(false)
  return (
    <div className="cc-section">
      <h2 className="cc-heading">扩展中心</h2>
      <p className="cc-intro">
        统一管理插件、Skill 与 MCP 服务器。插件改动写入 cordis.patch.yml，重启 Profile 生效；Skill 开关与 MCP 配置即时生效。
      </p>
      {needsRestart ? (
        <div className="cc-warnbar" role="status">
          <span>已写入 cordis.patch.yml — 重启 Profile 后生效：</span>
          <code>dsh --profile web 重启</code>
        </div>
      ) : null}
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
        {active === "plugins" && <PluginsTab onNeedsRestart={() => setNeedsRestart(true)} />}
        {active === "skills" && <SkillsTab />}
        {active === "mcp" && <McpTab scope={scope} />}
      </div>
    </div>
  )
}

export function apply(ctx: any) {
  injectCss()
  const slots = ctx.get("slots")
  if (slots === undefined) return
  // MCP 只读快照：绑定到本插件 fiber（dispose 随 fiber 回收）
  let scope = null
  try {
    scope = ctx.settingsScope?.bind ? ctx.settingsScope.bind({ namespace: "mcp-center" }) : null
  } catch {}
  slots.inject("settings.section", () =>
    slots.register(
      { name: "settings.section", id: "config-center", order: 30, label: "扩展中心" },
      (props: any) => <ConfigCenterSection scope={scope} close={props.close} />,
    ),
  )
}
