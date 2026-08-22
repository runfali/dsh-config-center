# dsh-config-center — 扩展中心 设计文档

> 统一在 WebUI 设置中配置 **插件 / Skill / MCP** 的一站式方案。设计目标：一步到位（方案 C：MCP 走 settings 动态挂载 + 插件/skill 走 cordis.patch.yml 文件编辑），但分层交付、可验证、可回滚。
>
> **v2（2026-08-22）**：按 `AUDIT.md` 审计结论修订 —— 新增 V-RPC 前置验证、MCP 改 mutate-only 写路径、Skills 机制纠正为 frontmatter 开关、`!!js` 保护、bundle 行只读。

## 0. 头部总表（做完一项勾一项）

| # | 阶段 | 任务 | 状态 | 负责人 | 备注 |
|---|------|------|------|--------|------|
| 0 | 文档 | 设计文档定稿 + 评审 | ◐ | 大鱼 | v2 已按审计修订，待发哥复核 |
| V | 验证 | **V-RPC 前置门**：静态 Bundle Client→Host 通道 | ☑ | 大鱼 | 定案方案 A：`ctx.webServer.register` /api 路由，见 §4.3 |
| 1 | 宿主 | Bundle 骨架 + package.json dsh.client 声明 + lib/client.js 空壳 | ☑ | 大鱼 | build 全绿；client 5.2kb envelope✓ host ESM✓ |
| 2 | MCP | Host `mcp-center` settings namespace + schemastery schema（secret 隔离） | ☑ | 大鱼 | ⚠️弃用union建模→扁平object（redact walker不下钻union）；redact/validate实测通过 |
| 3 | MCP | Host isolate realm 动态挂载 `dsh-mcp-client`（复用其导出 apply/Config）+ watch 重建 + 实时状态徽标 | ☑ | 大鱼 | mock ctx 冒烟过：挂载/disabled跳过/计数/dispose ✓ |
| 4 | 文件 | Host RPC `listRows/addRow/removeRow/updateRow/toggleRow/writePatch` + **插件增删改查** + contentHash 围栏 + `!!js` 行保护 | ☑ | 大鱼 | 结构感知 insert/group；18/18 单测过 |
| 5 | 文件 | Skill RPC：多根聚合扫描 / frontmatter 开关 / 删除(越界防护) / 模板新增 | ☐ | 大鱼 | P1-3 纠正后设计，watcher 热生效 |
| 6 | Client | `settings.section id=config-center` 注册 + 内部三 Tabs 壳（Plugins/Skills/MCP） | ☐ | 大鱼 | Slot: settings.section |
| 7 | Client | MCP Tab：**全部写走 mcpMutate pathOp（P0-2）** + SecretField + live 保存 + dirty/invalid/saving 状态机 | ☐ | 大鱼 | scope.set 在本插件禁用 |
| 8 | Client | Plugins Tab：表格 **(增/删/改/启用开关/行内 JSON 编辑)** + 校验高亮 + 重启黄条 + bundle/base 行只读展示 | ☐ | 大鱼 | host.call 文件 RPC |
| 9 | Client | Skills Tab：多根列表 + frontmatter 开关 + 详情抽屉 + 模板新增 | ☐ | 大鱼 | zip/git 上传二期 |
| 10 | 安全 | Secret redact / mutate(pathOp) / 危险操作二次确认 / 删除路径逃逸防护 | ☐ | 大鱼 | trust-fence 规避 |
| T | 测试 | vitest 单测：yaml 校验器 / !!js 检测 / diff rebuild / pathOp 构造器 | ☐ | 大鱼 | P2-8 |
| 11 | 验证 | 本地验证（build + 单测 + 结构检查）✅可自动执行；**真机挂载冒烟由发哥按 README 操作步骤执行**（约束：大鱼不安装、不重启 dsh） | ☐ | 发哥/大鱼 | 见 §8 与 README |
| 12 | 文档 | README + 截图 + 回滚说明 | ☐ | 大鱼 | 交付 |

> 勾选规则：`☐` 未开始 / `◐` 进行中 / `☑` 已完成。每次完成一项直接改本表。

> **交付约束（2026-08-22 发哥指令）**：大鱼**不执行安装、不重启 dsh** —— 交付项目 + git 仓库（逐项 commit 可回滚）+ README 操作步骤；真机挂载与冒烟由发哥按文档执行。
>
> **Git 规范**：项目根为独立 git 仓库；每完成总表一项即 `git commit -m "T<n>: <任务名>"`；`.gitignore` 排除 `node_modules/`、`lib/`（可由 `pnpm build` 重建）；回滚用 `git revert <commit>`。

---

## 1. 背景与目标

### 1.1 现状

- **插件**：`~/.dsh/profiles/<profile>/cordis.patch.yml` 的一行 `{id, name, config}`，由 `@deepseek-ai/cordis-plugin-include` + `cordis-plugin-loader` 在 profile 启动时 `Include` 拼树。改文件后多数需重启。
- **Skill**：`~/.dsh/skills` 目录 + `dsh-skill-filesystem` 服务，Add/Remove 走文件系统。
- **MCP**：`@deepseek-ai/dsh-mcp-client` 每行一 server，`tool` 暴露为 `mcp__<serverName>__<rawName>`，支持 `stdio` / `streamable-http`，自带重连与 `tools/list_changed` 重同步。

### 1.2 目标

- 在 WebUI `设置` 中提供单一入口「扩展中心」，三 Tabs 统一管理插件 / skill / mcp 的增删改查与启用态。
- MCP 配置即时生效（live），插件/skill 配置经文件落盘后提示重启（restart）。
- Secret 字段永不回显走线，编辑不丢密钥，校验在 Host 侧最终裁决。

### 1.3 非目标

- 不做插件市场/版本分发/依赖解析。
- 不重写个人 preset（`agent.cordis.yml`）编辑器，首版 focus 在 profile Host 组合；preset 编辑作为二期。
- 不接 MCP Resources/Prompts，仅 Tools。
- **bundle 安装的插件行只读展示**（P1-5）：其挂载由 profile `package.json` 的 `dsh.profile.bundles` 管理，UI 不代管安装源；用户 patch 行才开放增删改。

## 2. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  Host (Node)  dsh-config-center/src/index.js                │
│  ├─ settings «mcp-center»  (dict<serverName, McpEntry>)    │─> settings.yaml (live)
│  ├─ isolate[mcp]: 动态 N× dsh-mcp-client 子 fiber         │─> ctx.tools 注册
│  ├─ RPC: listRows/readPatch/writePatch (cordis.patch.yml) │─> 原子写 + entryListSchema
│  ├─ RPC: listSkills/addSkill/removeSkill                  │─> ~/.dsh/skills
│  └─ RPC: testMcp (临时 client 探活)                       │
├─────────────────────────────────────────────────────────────┤
│  Client (Web)  dsh-config-center/lib/client.js              │
│  └─ settings.section id=config-center                       │
│     ├─ Tabs: [ Plugins | Skills | MCP ]                    │
│     ├─ MCP Tab  ── settingsScope.bind(mcp-center) + CardForm │
│     ├─ Plugins Tab ── host.call 文件 RPC + JSON 编辑器     │
│     └─ Skills Tab  ── host.call skill RPC                  │
└─────────────────────────────────────────────────────────────┘
```

**Bundle 形态**（零侵入，不改 dsh 安装目录）：

- `package.json` 声明 `dsh.client: { platform:"web", inject:["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-api-remotes","@deepseek-ai/dsh-client-ui-settings"], immediately:false }` + `exports["./client"] -> lib/client.js`
- `cordis.patch.yml` 仅挂 Host entry：`name: /abs/path/to/dsh-config-center/src/index.js`
- `lib/client.js` 的 `id` 必须等于包名（`window.__ModuleLoader__.load({id})` 约定）。

## 3. 数据模型

### 3.1 MCP — settings namespace `mcp-center`

```ts
// schemastery（z），secret 字段 role('secret')
const McpStdio = z.object({
  transport: z.const('stdio').required(),
  serverName: z.string().pattern(/^[A-Za-z0-9_-]{1,32}$/).required(),
  command: z.string().required().description('可执行文件'),
  args: z.array(z.string()).default([]),
  env: z.dict(z.string().role('secret')).default({}), // 刺激：保持稀疏，mutate 写入
  cwd: z.string().optional(),
  toolCallTimeoutMs: z.number().min(1000).max(300000).optional(),
  failOnStartupError: z.boolean().default(false),
  reconnect: z.object({
    enabled: z.boolean().default(true),
    initialDelayMs: z.number().default(500),
    maxDelayMs: z.number().default(30000),
    maxAttempts: z.number().default(10),
  }).optional(),
  enabled: z.boolean().default(true),
})

const McpHttp = z.object({
  transport: z.const('streamable-http').required(),
  serverName: z.string().pattern(/^[A-Za-z0-9_-]{1,32}$/).required(),
  url: z.string().role('link').required(),
  headers: z.dict(z.string().role('secret')).default({}),
  toolCallTimeoutMs: z.number().optional(),
  failOnStartupError: z.boolean().default(false),
  reconnect: z.object({...}).optional(),
  enabled: z.boolean().default(true),
})

const McpCenterSchema = z.dict(z.union([McpStdio, McpHttp]))
```

- `applies: 'live'`，`describe(redactSecrets:true)`，写路径用 `mutate([pathOp])` 避免 redact 视图重建时丢 secret。
- `enabled=false` 的条目 Host 侧不挂载，但保留在文档中以便 UI 切换。

### 3.2 插件/skill — 文件行

```ts
type PluginRow = {
  id: string          // [a-z0-9][a-z0-9-]*，cordis 行 id
  name: string        // 包名 或 绝对路径 /abs/...
  config?: unknown    // 任意 JSON，Host 侧用 entry 对应 schema 二次校验
  disabled?: boolean
  group?: boolean
  isolate?: Record<string, boolean>
  // 仅展示：__meta: { source: 'patch'|'base', broken?: string }
}
```

校验：复用 `@deepseek-ai/cordis-plugin-include` 的 `entryListSchema`（含 `!!js` 方言），Host 侧先过 schema 再 `load()` 试解析，失败回显首错行号。

## 4. Host 详细设计

### 4.1 MCP 动态挂载

- `ctx.inject(['settings'], ...)` 注册 `mcp-center`，`scope.watch(next=>rebuild(next))`。
- `rebuild(doc)`：
  1. 计算 `desired = Object.entries(doc).filter(([,v])=>v.enabled)`；
  2. 对比 `prev` 的 `serverName` 集合，diff 出 `toAdd/toRemove/toUpdate`；
  3. `toRemove`：`dispose()` 对应 isolate 子 fiber（`ctx.effect` 返回的 disposer）；
  4. `toAdd/toUpdate`：在 `isolate: { mcp: true }` 的 group 下 `ctx.effect(() => ctx.plugin(childConfig))`，`childConfig` 即透传给 `dsh-mcp-client` 的原始 config（含 env/headers 已还原 secret 实值）；
  5. 保持 `serverName` 唯一，重复时整代回滚并 `ctx.logger.error`。
- 探活：`testMcp(candidate)` 临时 `new Client + createTransport(candidate) + listTools()` 60s 超时，返回 `tools.length` 与样例。

### 4.2 文件 RPC（插件增删改查核心）

```ts
harness.handle('config-center:listRows', async () => {
  const patch = await readFile(patchPath, 'utf8').catch(()=> '[]')
  const rows = load(patch, {schema: entryListSchema}) // 含 !!js 方言
  const entries = ctx.loader.entries()
  return { patchPath, rows, entries: entries.map(e=>({id:e.options.id, name:e.options.name, status:e.fiber?.state})) }
})
// 插件增删改查 — 全部经此单点落盘，前端只做乐观 UI
harness.handle('config-center:addRow', async ({row}) => {
  // 1. 校验 id 唯一、name 非空、entryListSchema 单行校验 2. rows.push(row) 3. 原子写 4. {needsRestart:true}
})
harness.handle('config-center:updateRow', async ({id, patch}) => {
  // 按 id 定位行，merge patch（id 不可改），单行校验后原子写
})
harness.handle('config-center:removeRow', async ({id}) => {
  // 按 id 删除，二次确认已在前端完成，Host 侧再判存在性后原子写
})
harness.handle('config-center:toggleRow', async ({id, disabled}) => {
  // 仅翻 disabled 位，快路径，校验后原子写
})
harness.handle('config-center:writePatch', async ({rows}) => {
  // 全量覆盖（用于重排/批量导入），整表 entryListSchema 校验后原子写
})
harness.handle('config-center:readDocument', async () => ctx.settings.prepareDocument?.())
```

- **增**：前端「新增插件」按钮 → 弹窗表单（id/name/config JSON/disabled），id 正则 `^[a-z0-9][a-z0-9-]*$` 且全表唯一，name 必填（npm 包名或 `/abs/path`），config 为可选 JSON，提交走 `addRow`，失败行内回显 `entryListProblem` 首错。
- **删**：每行操作列「删除」→ 二次确认 `确认删除插件 <id> (<name>)？此操作将改写 cordis.patch.yml 并需重启` → 走 `removeRow`。
- **改/启用**：行内「编辑」抽屉改 name/config，开关直接 `toggleRow`。
- 写前 `compositionProblem` 风格 shape 检查，失败不落盘；并发写自维护 `writeQueues: Map<'patch',Promise>` 串行化，原子写 `writeFileAtomic(tmp+rename, 0600)` 并保留 `.bak`。
- **修订围栏（P2-7）**：`listRows` 返回 `contentHash`（sha256 of 文件字节），所有写 RPC 强制携带 `expectedHash`，不匹配拒绝 409，前端提示刷新。
- **`!!js` 保护（P1-4）**：落盘前扫描将写入的内容是否含 `!!js` 表达式（新增/修改的行）；命中即拒绝该行并在 UI 标注「含动态表达式，请在文件中手工编辑」，防止 load→dump 往返把动态求值语义变成字面量。未触及的既有 `!!js` 行在全量 `writePatch` 场景同样触发整单拒绝。

### 4.3 Client→Host RPC 通道决策（V-RPC 前置门，P0-1）✅ 已定案

> **决策：方案 A 成立，无需兜底。** 证据链（2026-08-22 验证）：
> 1. `dsh-paperclip/src/index.js:168` 生产在用：`ctx.webServer.register({ kind:'prefix', path:'/api/upload', handler })` —— 静态 bundle 宿主半可注册自定义 `/api/*` 路由；
> 2. handler 签名 `async (req, res) => {}`，注册返回 disposer，随 fiber 释放；
> 3. 浏览器半直接 `fetch('/api/upload', {method:'POST'})` 同源直达（paperclip `src/client/upload.ts`），经 login-gateway 反代无障碍；
> 4. 安全围栏由 handler 自查（loopback / origin / sec-fetch-site，照抄 paperclip `createUploadHandler` 的围栏段）；
> 5. host 半声明方式：`export const inject = ['webServer','settings',...]`；client bundle 构建 esbuild CJS + `__ModuleLoader__` envelope（复用 paperclip `build.mjs` 模式）。

**落地方案**：宿主半注册 `{kind:'exact', path:'/api/config-center/<method>'}` 系列 JSON 端点；客户端封装 `rpc(method, args)` 工具函数调用。每个写端点内置 paperclip 式同源围栏 + contentHash 围栏。

## 5. Client 详细设计

### 5.1 入口

```js
// lib/client.js  (plain JS, 无 JSX/TS/import)
exports.inject = ['settingsScope','slots']
exports.apply = (ctx)=>{
  const slots = ctx.get('slots')
  if(!slots) return
  slots.inject('settings.section', ()=> slots.register(
    {name:'settings.section', id:'config-center', order:30, label:'扩展中心'},
    (props)=> React.createElement(ConfigCenterSection, {close: props.close})
  ))
}
```

`ConfigCenterSection` 内自持 `activeTab: 'plugins'|'skills'|'mcp'`，Tab 切换仅本地 state，不涉 Host。

### 5.2 MCP Tab

- `const scope = ctx.settingsScope.bind({namespace:'mcp-center'})` —— **只读**。快照（value/user/base/revision/writable）用于渲染与 dirty 判定。
- **写路径（P0-2，审计修订）**：一切变更（含 `enabled` 开关）一律走 `rpc('mcpMutate', {ops, expectedRevision})` → Host 侧 `ctx.settings.mutate('mcp-center', pathOps, expectedRevision)`，在含真实 secret 的原始 section 上合并后落盘。客户端只提交变更字段的 pathOp：
  - 改 command：`{op:'set', path:['github','command'], value:'npx'}`
  - 设密钥：`{op:'set', path:['github','env','GITHUB_TOKEN'], value:'…'}`
  - 切开关：`{op:'set', path:['github','enabled'], value:false}`
  - 删条目：`{op:'unset', path:['github']}`
- **禁止**使用 `scope.set/unset` 整条回写（redacted 视图会抹掉存量 secret）。
- 控件：`ValueField`（serverName/command/args/url 等）+ `SecretField`（env/headers，仅显示 configured 徽标，不回显实值）。
- 行操作：新增（表单校验 `serverName` 正则 + 全表唯一）、编辑抽屉、启用开关、删除（二次确认）、探活（`testMcp` 返回 tools 数量与样例名）、**连接状态徽标（P2-6）**：supervisor 实时上报 connected/connecting/error/tools N，随 settings watch 与 RPC 轮询刷新。

### 5.3 Plugins Tab（增删改查完整）

- 初次 `await rpc('listRows')`，渲染表格：`id | name | enabled | 来源 | 状态 | 操作`，顶部「新增插件」主按钮。
- **来源列（P1-5）**：每行标注 `user`(patch) / `bundle` / `base`；仅 `user` 行开放增删改，bundle/base 行只读展示并注明「由 bundle 安装或基础组合提供，请管理对应安装源」。
- **新增**：点击 → 弹窗表单（id/name/config JSON/是否禁用），id 校验唯一性 + 正则，name 支持 npm 包名或绝对路径，config 为 JSON 文本框（`JSON.parse` 校验，失配整行标红 + 行号提示），提交走 `rpc('addRow', {row, expectedHash})`。
- **删除**：每行操作列「删除」→ 二次确认弹层 `确认删除插件 <id> (<name>)？此操作将改写 cordis.patch.yml 并需重启` → 走 `rpc('removeRow')`，成功 toast + 行移除。
- **编辑**：行内「编辑」抽屉改 name/config，提交走 `updateRow`；`disabled` 开关直接走 `toggleRow`，置灰整行。
- **批量/重排**：底部 Footer `丢弃 | 保存` 用于重排或批量导入场景，走 `writePatch({rows})` 全量覆盖；成功后顶部黄条「已写入 `cordis.patch.yml`，需重启 Profile 生效」+ 提供「复制重启命令」`dsh --profile web restart`；保存后轮询 `listRows` 的 entries 变化，提示「检测到已重启 ✓」。
- `broken` 行红字提示首错（`entryListProblem` 首错行号），不可保存。

### 5.4 Skills Tab（P1-3 纠正后设计）

> 审计确认：skill 无「disabled 目录标记」；真实机制是 `SKILL.md` frontmatter 布尔位，且 watcher 热生效**无需重启**。

- **列表**：`rpc('listSkills')` 聚合 5 个发现根（rank 100 project `.dsh/skills` → 500 `~/.agents/skills`，跳过 `.system`），每行显示 `name | 来源根(rank) | 模型可见 | 用户可调 | 描述 | broken?`。
- **开关（写操作仅限 user 根 rank 400）**：
  - 「模型可见」↔ frontmatter `disable-model-invocation: true/false`
  - 「用户可调」↔ frontmatter `user-invocable: true/false`
  - 走 `rpc('setSkillFlags', {root, name, flags, expectedHash})`，Host 解析→改 YAML frontmatter→原子写回；watcher 自动失效重建，UI 数秒内反映。
- **删除**：仅 user 根，二次确认 + Host 侧 realpath 后校验 `startsWith(skills 根)` 防路径逃逸，再 `rm -rf`。
- **新增（首版最小可用）**：模板创建 —— 表单填 `id`(kebab-case)/`description`/`whenToUse` → Host 生成 `<user-root>/<id>/SKILL.md` 骨架；zip 上传 / git clone 二期。
- 非 user 根（项目/自定义/agents）行只读展示并注明来源。

## 6. 安全与边界

- **Secret**：schema 标 `role('secret')`，`describe` 侧 redact，写侧 `mutate` 按 `path` 精确改，不经 `replace` 全量重建。
- **权限**：Host 侧写 `~/.dsh` 需 `0600/0700`，`writeFileAtomic` 原子写；Client 侧无直接文件权限，必经 `host.call`。
- **Trust Fence**：所有写经 Host，不走 `/api` 特权直写，规避 `trustedHosts` 403。
- **校验**：`entryListSchema` + 运行时 `ctx.loader.entries()` 双重校验，非法行拒绝落盘并回显首错。
- **二次确认**：删除/覆盖/重启三类操作强制确认，避免静默丢配置。

## 7. 实施计划（与头部总表一一对应）

- [ ] **V-RPC 前置门**：按 §4.3 验证 Client→Host 通道（方案 A 探测 / 方案 B 兜底落地），决策记录归档 —— **阻塞 T4/T5/T8/T9**
- [ ] **T1 骨架**：`pnpm init` + `package.json dsh.client` + `src/index.js` / `lib/client.js` + `cordis.patch.yml` 挂载验证（`curl /plugins/dsh-config-center/client.js` 200，`__DSH_BOOT__` 含 id）
- [ ] **T2 MCP schema**：Host `settings.register('mcp-center', McpCenterSchema, {applies:'live'})` + client `bind` 冒烟
- [ ] **T3 动态挂载**：`ctx.isolate('mcp')` + `ctx.plugin(mcpClientApply, config)` diff rebuild + `testMcp` 探活 + 状态徽标数据源
- [ ] **T4 文件 RPC**：listRows/addRow/removeRow/updateRow/toggleRow/writePatch + entryListSchema + 原子写 + contentHash 围栏 + `!!js` 保护（插件增删必测）
- [ ] **T5 Skills RPC**：多根聚合扫描 / setSkillFlags(frontmatter) / 删除(越界防护) / 模板新增
- [ ] **T6 Section 壳**：settings.section 注册 + 三 Tabs + i18n key 占位
- [ ] **T7 MCP Tab 完成**：CardForm/ValueField/SecretField + live 保存
- [ ] **T8 Plugins Tab 完成**：表格 + **新增弹窗 + 删除二次确认 + 编辑抽屉 + 启用开关** + JSON 编辑 + 重启提示
- [ ] **T9 Skills Tab 完成**：多根列表 + frontmatter 开关 + 模板新增
- [ ] **T10 安全收口**：secret/mutate/确认弹窗/路径逃逸防护
- [ ] **T-test 单测**：vitest 覆盖 yaml 校验器 / `!!js` 检测 / diff rebuild / pathOp 构造器（P2-8）
- [ ] **T11 真机验证**：见 §8
- [ ] **T12 文档**：README/回滚/截图

## 8. 验证清单

```bash
# 1. 挂载检查
curl -s http://127.0.0.1:3080/ | grep -o 'dsh-config-center'
curl -s http://127.0.0.1:3080/plugins/dsh-config-center/client.js | head

# 2. MCP 冒烟
# UI 新增 stdio: npx -y @modelcontextprotocol/server-everything -> 保存 -> 模型工具列表出现 mcp__<name>__*
# UI 探活按钮 -> 返回 tools 数量
# 禁用/删除 -> 工具消失

# 3. 插件增删改冒烟（必测）
# UI 点击「新增插件」→ 填 id: hello, name: /abs/path/to/demo-plugin, config:{} → 提交 -> 列表出现 hello（置灰需重启）
# 切 disabled 开关 -> 行置灰/恢复
# 点编辑 -> 改 config JSON -> 保存
# 点删除 hello -> 二次确认 -> 行消失
# 黄条提示重启 -> 重启后 loader.entries() 含/不含 hello 对应

# 4. 回滚
# 删除 cordis.patch.yml 中新增行 -> 重启 -> 恢复基线
# settings.yaml 中 mcp-center 段置空 -> MCP 工具全量下线
```

## 9. 风险与回滚

| 风险 | 对策 |
|------|------|
| `cordis.patch.yml` 写坏导致 profile 无法启动 | 写前校验 + 原子写 + 保留 `.bak`，启动失败时文档提示 `mv cordis.patch.yml.bak cordis.patch.yml` |
| secret 误删 | **mutate-only 写路径（P0-2）**：客户端永不整条回写，pathOp 精确改；redact 视图不含实值 |
| 静态 bundle 无 RPC 通道（P0-1） | §4.3 V-RPC 前置门：方案 A 探测网关扩展点，方案 B 内部 listener + login-gateway 反代兜底 |
| `!!js` 动态语义被 round-trip 抹掉（P1-4） | 含 `!!js` 的行拒绝 UI 修改，引导手工编辑 |
| 双端并发覆盖 patch（P2-7） | contentHash 修订围栏，不匹配拒绝 409 |
| skill 删除路径逃逸 | realpath + startsWith(根) 校验后才 rm |
| HMR 不生效 | 明确标 `restart`，不假装 live；skill/MCP 为 live 已由 watcher/supervisor 保证 |
| 预设隔离泄漏（service 挂到 root realm） | 严格 `ctx.isolate('mcp')`，mount 校验 `leakedServices` |
| testMcp 属任意命令执行面 | 仅 loopback + 网关会话鉴权前提下开放，文档注明信任前提 |

## 10. 附录

- 参考实现：`@deepseek-ai/dsh-mcp-client`（README 含命名/重连/图片桥接细节）、`@deepseek-ai/dsh-settings`（三层合并/队列/冲突）、`dsh-client-ui-settings-plugins`（CardForm/PluginCard/fields.module.css）。
- 约束：`apply` 同步、`ctx.logger` 不解构、`ctx.get('slots')` 判空、`React.createElement` 无 JSX、`timer` 需 `inject:['timer']`。

---

> 下一步：发哥确认本设计后，大鱼按 T1→T12 顺序逐项实施，每完成一项更新头部总表并演示验证。
