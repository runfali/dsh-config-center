# dsh-config-center 设计审计报告

> 审计人：实施方 · 2026-08-22 · 方法：逐条对照 rc.2 真实源码验证设计假设（cordis / dsh-settings / dsh-client-runtime / dsh-client-ui-settings* / dsh-mcp-client / dsh-skill-filesystem / cordis-plugin-include）

## 一、总体结论

**骨架成立，但有 2 个阻断级（P0）、3 个重要（P1）问题。修复前不具备实施条件；修复后功能完整性可达标。** 设计中「Client 走 host.call、MCP 编辑用 scope」两大支柱各有一处与真实运行时不符的假设。

## 二、已验证成立的假设 ✅

| # | 假设 | 验证结果 |
|---|------|----------|
| G1 | 动态挂载子插件可行 | `ctx.plugin(plugin, config?)` 存在（cordis `registry.d.ts:198`）；且 `@deepseek-ai/dsh-mcp-client` 导出 `{ Config, apply, inject, name }`，可整体复用其桥接逻辑，无需自己实现 SDK 连接层 |
| G2 | isolate realm 运行时可用 | `ctx.isolate(name, label?)` 存在（cordis `context.d.ts:83`），同 label 合并 scope |
| G3 | `entryListSchema` 可复用校验 | 确认由 `@deepseek-ai/cordis-plugin-include` 导出（`['Include','applyEntryPatches','default','entryListSchema']`） |
| G4 | settings 落盘安全 | `dsh-settings-file` 使用 `withFileLock + writeFileAtomic(mode 384=0600)`，secret 明文落盘但权限收敛 |
| G5 | `settings.section` Slot 契约 | kind:list / scope:root / options `{id, order, label}` / owner props `{close}`，第三方可注册新页 |
| G6 | Client bundle 双层 inject | `exports.inject = ['slots','locale','connection',...]`（短服务名）模式在官方包确认 |
| G7 | 技能热生效 | `dsh-skill-filesystem` Chokidar watcher 监视 SKILL.md/frontmatter 变更自动失效重建，**skill 改动不需要重启** |

## 三、发现的问题

### 🔴 P0-1 静态 Bundle 的 Client→Host RPC 通道未证实（阻断 T4/T8）

- **事实**：`harness.handle()` / `host.call()` 是**动态插件**的 Builtin 通道。全量扫描官方静态 bundle 包（`--include lib/index.js`），**零处使用** harness.handle。静态 bundle 的宿主半是否拥有 `harness` 内建、浏览器端是否有对应 call 路径，均未证实。
- **影响**：Plugins Tab 全部 CRUD RPC、Skills RPC、`testMcp` 探活 —— 设计里所有 `host.call` 都可能落空。
- **对策（写入 §4.3，作为 T4 的前置门 V-RPC）**：
  1. 优先验证：Host 侧 `Service.listService` 检索是否存在通用 RPC/路由注册服务（api-gateway 扩展点）；若有则走它。
  2. 兜底方案 B（确定可行）：宿主半自起 `127.0.0.1:<port>` 内部 listener，复用已部署的 dsh-login-gateway 反代增加 `/cc/*` 路径转发 + 会话 cookie 鉴权。客户端 `fetch('/cc/rpc/<method>')` 同源直达。

### 🔴 P0-2 现设计 §5.2 的 MCP 写路径会静默抹掉 secret（阻断 T7）

- **事实**：客户端 `SettingsScope` 契约只有顶层字段级 `set(field, value)` / `unset(field)`（`client-runtime contract/settings-scope.d.ts`），**没有 path 级 mutate**。而 `mcp-center` 是 dict 嵌套结构，任何对单条 server 的编辑（哪怕只改 `enabled`）按 scope.set 都得提交整个 entry 对象。
- **后果**：UI 持有的是 redacted 视图（env/headers 实值已被剥离），整条回写 → **存量密钥被空值覆盖，且无报错**。
- **对策**：MCP 的**一切写操作**（含 enabled 开关）统一走 Host RPC 包装 `ctx.settings.mutate('mcp-center', pathOps, expectedRevision)`；客户端只提交变更字段的 pathOp（如 `{op:'set', path:['github','env','GITHUB_TOKEN'], value:'...'}`）。Host 在含真实 secret 的原始 section 上合并，schema 校验后落盘。`scope.set` 在本插件中完全不使用。

### 🟠 P1-3 Skills 启用/禁用机制写错了（T5/T9 需返工）

- **事实**：skill 没有「disabled 目录标记」。真实机制是 `SKILL.md` frontmatter 字段：`disable-model-invocation: true`（模型不可见）/ `user-invocable: false`（用户命令不可见）；且发现源是多根 rank 制（project `.dsh/skills`=100、`.agents/skills`=200、custom=300、user `~/.dsh/skills`=400、`~/.agents/skills`=500，`.system` 子目录跳过）。
- **对策**：§5.4 重写 —— 列表聚合约 5 个根并标注来源/可写性（只有 user 根可写）；开关 = Host RPC 改 frontmatter 两布尔位；watcher 热生效**无需重启**；删除仅限 user 根且做 realpath 越界防护。

### 🟠 P1-4 YAML round-trip 破坏 `!!js` 标签（数据正确性）

- **事实**：patch 行支持 `!!js process.env.GITHUB_TOKEN` 动态求值。`load → dump` 往返会把求值结果序列化成字面量，**动态语义丢失**。
- **对策**：`addRow/updateRow/writePatch` 落盘前扫描目标内容含 `!!js` 的行；命中即拒改该行并在 UI 标注「含动态表达式，请手工编辑文件」。不做行级手术拼接（复杂度不值，二期再议）。

### 🟠 P1-5 插件可见性缺口：bundle 来源行管不到

- **事实**：生效组合 = base `cordis.yml`(空) + **profile `package.json` 的 `dsh.profile.bundles` 各自带入的 patch**（如 login-gateway）+ 用户 `cordis.patch.yml`。只编辑后者，bundle 装的插件（及未来 `dsh plugin --profile add` 的）在 UI 中既看不到也管不了。
- **对策**：`listRows` 返回三段来源（base/bundle/user），bundle/base 行**只读展示**并注明原因；文档 §1.3 明示此局限。用户 patch 行才开放增删改。

### 🟡 P2 级（不阻断，列入任务）

| # | 问题 | 对策 |
|---|------|------|
| P2-6 | 只有手动探活，缺连接状态 | supervisor 维护每 server 实时状态（connected/connecting/error/tools N），Tab 内徽标展示 + 工具数预览 |
| P2-7 | 文件写缺修订围栏，双端并发互相覆盖 | `listRows` 附 `contentHash`，写请求强制携带，不匹配拒绝（409） |
| P2-8 | 无自动化测试 | 补 vitest 单测：yaml 校验器、!!js 检测、diff rebuild、pathOp 构造器；冒烟清单已有 §8 |
| P2-9 | 杂项 | locale 变化需重注册 label（先单语硬编码+TODO）；section 加 React 错误边界与加载态；删除类操作统一确认弹窗组件；`testMcp` 属任意命令执行面，依赖 loopback+网关鉴权，文档注明信任前提 |

## 四、功能完整性判定（对照三诉求）

| 诉求 | 判定 | 条件 |
|------|------|------|
| 插件增删改查 | ✅ 可达 | 修 P0-1（RPC 通道）、P1-4（!!js 保护）、P1-5（bundle 行只读）后闭环 |
| Skill 配置 | ⚠️ 最小可用 | 修 P1-3 后：列表/启用禁用/删除/编辑 frontmatter 可达；「新增 skill」首版降级为**模板创建**（填 id+name+description 生成 SKILL.md 骨架），zip 上传/git clone 二期 |
| MCP 配置 | ✅ 可达 | 修 P0-2（mutate-only 写路径）后闭环，live 生效 |

另注：**重启仍无法从 UI 触发**（运行时无公开 restart RPC），保持「黄条 + 复制命令」交互；可在保存后轮询 `listRows.entries` 变化提示「检测到已重启」。

## 五、处置

以上结论已回写 `DESIGN.md`：头部总表新增 V-RPC 前置验证行与 P2 任务行；§4 新增 4.3「RPC 通道决策」；§5.2 改为 mutate-only；§5.4 整节重写；§9 风险表补充。设计文档版本号升至 v2，复核后进入 T1。

---

## 附录：实现期代码审计（2026-08-22 第二轮，代码完成后）

对照真实宿主 API 逐文件复查 + 真 HTTP 栈集成测试，新发现并已修复：

| # | 严重度 | 问题 | 修复 |
|---|--------|------|------|
| C1 | 🔴 高 | supervisor rebuild 无串行化：watch 快速触发时多个 async rebuild 交错，teardown/mount 可能乱序 | rebuild 队列化 + 突发合并（只消费最新文档），回归测试覆盖 |
| C2 | 🟠 中 | 删除 MCP server 后 status Map 残留 → statusList 回显幽灵行 | applyRebuild 尾部清理文档外条目 |
| C3 | 🟠 中 | validateRows 字段白名单误伤带 loader 高级字段（inject/provide…）的既有合法行 | 全表校验放宽（round-trip 保真）；addRow 保持严格白名单（UI 注入面） |
| C4 | 🟠 中 | 编辑 MCP 条目看不到已配置 secret 的键名（redacted 视图 env={}） | 新增 `mcpSecrets` sidecar RPC（仅键名+set 布尔），编辑抽屉异步填充并显示「已配置」 |
| C5 | 🟡 低 | ensureExistsAndInside 在 parent 为 symlink 时 realpath 拼接误判 | 重写为 realpath(parent)+basename |
| C6 | 🟡 低 | PluginsTab doc 未加载时 expectedHash=undefined 绕过围栏 | 前端禁写提示 |
| C7 | 🟡 低 | settings.yaml 存量 mcp-center 段损坏 → register reject → 整插件激活失败 | try/catch 降级：MCP 功能缺席、其余照常，warn 日志 |
| C8 | 🟡 低 | mcpMutate 未携带 revision 围栏 | UI 传 scope.snapshot.revision |

**排除的疑点（实测不成立）**：
- testMcp stdio 缺 PATH —— SDK `getDefaultEnvironment()` 自带 sudo 风格白名单合并 ✓
- inject 回调内调用 ctx.effect/scope.register —— cordis effect 约束是「fiber 已 dispose 才抛 INACTIVE_EFFECT」，inject 回调运行于活 fiber，官方 installSettingsSection 同模式 ✓
- dsh-mcp-client inject 仅 ['tools']，无可选服务硬等待 ✓

**保留的已知限制**（设计权衡，非缺陷）：`!!js` 动态表达式 load 后无法从文本识别（启发式检测尽力而为）；UI 单语文案；bundle 来源插件行只读。

# dsh-config-center 审计报告（第三轮：v0.2.0 alpha.3 适配复核）

> 审计时间：2026-09-01 · 审计对象：v0.2.0（commit 420ae32，dsh 0.1.2-alpha.3 适配后）
> 方法：代码级逐文件通读（host 8 模块 + client 6 文件 + 5 测试文件）+ 契约级源码对照（dsh-settings / dsh-mcp-client / cordis-plugin-include / dsh-web-server / dsh-fs）+ 测试执行（46/46 + typecheck 0 错）
> 前两轮见本文件上文（2026-08-22 设计审计 + 实现期代码审计）——本轮是适配后全量复核，含换角度清单。

## 一、总体结论

**无 P0/P1**；发现 2 个 P2、4 个 P3。前两轮 C1-C8 全部保持修复状态（本轮重走代码确认）。46 项测试 + typecheck 全绿；真 HTTP 栈集成测试覆盖 RPC 围栏与错误路径。

## 二、契约级核实（通过 ✅）

| 契约点 | 核实结果 |
|---|---|
| `settings.register/describe/mutate` | dsh-settings `lib/index.js`：register 带 `applies:'live'` + validate 钩子 ✅；`describe({redactSecrets:true})` 返回 secrets 路径数组 ✅；`mutate(ns, ops, expectedRevision)` 真实存在（433 行），op 限 `{set,path,value}/\{unset,path\}` ✅——config-center 的 pathOp 写路径（P0-2 修复）与宿主契约一致 |
| `settings.mutate` 的 `ops` 校验 | `path` 必须全 string 数组、set 的 value 必须 plain object 才能设根——与 client pathOp 构造一致 ✅ |
| `cordis-plugin-include` 的 `entryListSchema` | `yaml.JSON_SCHEMA.extend(JsExpr)` 真实导出（lib/index.js:28,284）——patch-editor 用它 load ✅ |
| `webServer.register({kind:'exact'|'prefix', path, handler})` | dsh-host-webserver 真实实现：duplicate 抛错、返回 disposer ✅ |
| `ctx.isolate('mcp')` + `ctx.plugin(dshMcpClient, config)` | cordis `ctx.isolate` 真实存在；dsh-mcp-client 导出 `{Config, apply, inject, name}` 可整体复用 ✅（supervisor mount 用法正确） |
| `tools/change` 事件 | supervisor 用 `ctx.on('tools/change', ...)` 刷计数——事件名需与宿主一致（dsh-tools 注册表变更事件）✅ |

## 三、发现的问题（本轮新）

### 🟠 P2-1 `ping` RPC 版本号硬编码 "0.1.0"

- **事实**：`src/index.js:257` `version: "0.1.0"` 硬编码，package.json 已是 0.2.0。
- **影响**：状态接口/客户端显示旧版本，误导排障。
- **修复**：从 package.json 读取（同 skill-curator 的 `VERSION` 模式）。

### 🟠 P2-2 `writeSkillFile` 的 expectedHash 空值绕过围栏

- **事实**：`src/index.js:376` `args?.expectedHash === undefined ? null : ...`，skills-editor `writeSkillFile` 中 `expectedHash !== null && !== undefined && !== ''` 才校验——**空字符串或 null 时围栏失效（force save）**。
- **影响**：理论上 client 总传 hash（SkillFileEditor 从 readSkillFile 拿），但 RPC 面**允许跳过围栏**——若前端 bug 或恶意调用，双端并发编辑互相覆盖。
- **修复**：host 侧把「null/空 → 拒绝」改为默认拒绝（除非显式 `force` 标志），与 patch-editor 的 hash 围栏行为对齐。

### 🟡 P3 杂项（本轮）

| # | 问题 | 说明 |
|---|---|---|
| P3-1 | `guardSameOrigin` 与 skill-curator 守卫不一致 | config-center 放行非 loopback 的 same-origin/same-site；skill-curator 只放行 loopback。行为差异无安全漏洞（两者都拦 cross-site），但建议统一文档口径 |
| P3-2 | `testMcp` stdio 探活不校验命令白名单 | 设计权衡（P2-9 已注明信任前提），本轮确认保持 |
| P3-3 | client `McpTab` 探活 `headers: {}` 硬编码 | 编辑抽屉里配置的 headers 未带入探活候选（secret 不回传 wire 是安全设计，但探活结果对带鉴权的 server 会误报失败）——已知限制，README 建议注明 |
| P3-4 | `listRows` 对 `patchPath` 不存在时返回 `{raw:"[]\n"}` 假空文档 | 用户从未建过 patch 文件时 UI 显示空表而非「未初始化」提示；低影响 |

## 四、换角度复核（前两轮未覆盖）

- **并发/乱序写**：patch 写有 `enqueuePatch` 串行队列 + contentHash 围栏（409）✅；pnpm 安装有 `enqueuePnpm` 队列 ✅。
- **只读端点无副作用**：所有 RPC 均为 POST/GET；GET 仅 `ping/mcpStatus/mcpSecrets/listRows/listSkills/readSkillFile/listBundles`——均无副作用 ✅；`writeSkillFile/readSkillFile` 有 hash 围栏 ✅。
- **secret 不落 wire**：`mcpSecrets` 只回键名 + set 布尔（`describe({redactSecrets:true}).secrets` 过滤 path/set）✅；client 编辑抽屉回填「已配置」占位、留空保持现值（`pairsToOps`）✅——P0-2 防线完整。
- **supervisor 生命周期**：`dispose()` 清 live/status/pendingDoc；`rebuild` 串行队列 + 突发合并（只消费最新文档）✅；幽灵行清理（C2 修复）保持 ✅。
- **group 行 toggle 拒绝**（P3 边界）：`toggleRow` 对 group 行抛错 ✅。

## 五、处置

无 P0/P1。P2-1 版本号读取、P2-2 围栏收紧为建议修复；P3 项文档化。修复后按停止线开新一轮。
