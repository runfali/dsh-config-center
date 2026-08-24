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
