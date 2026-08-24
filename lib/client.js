window.__ModuleLoader__.load({id:"dsh-config-center",factory:(require)=>{var module={exports:{}};var exports=module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(client_exports);
var import_react5 = require("react");

// src/client/McpTab.tsx
var import_react2 = require("react");

// src/client/rpc.js
async function rpc(method, args) {
  const res = await fetch(`/api/config-center/${method}`, {
    method: args === void 0 ? "GET" : "POST",
    headers: args === void 0 ? void 0 : { "content-type": "application/json" },
    body: args === void 0 ? void 0 : JSON.stringify(args)
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
  }
  if (!res.ok || !body?.ok) {
    const err = new Error(body?.error ?? `rpc ${method} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}
function errText(err) {
  return String(err?.message ?? err);
}
function confirmDialog(text) {
  return Promise.resolve(globalThis.confirm ? globalThis.confirm(text) : true);
}

// src/client/ui.jsx
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
function Field({ label, hint = void 0, invalid = void 0, invalidText = void 0, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cc-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cc-field-head", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "cc-label", children: label }) }),
    children,
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: invalid ? "cc-invalid" : "cc-hint", children: invalid ? invalidText || "invalid" : hint || "" })
  ] });
}
function TextInput({ value, onChange, placeholder = void 0, invalid = void 0, type = "text" }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "input",
    {
      className: "cc-input" + (invalid ? " cc-input-invalid" : ""),
      type,
      value: value ?? "",
      placeholder: placeholder ?? "",
      autoComplete: "off",
      onChange: (e) => onChange(e.target.value)
    }
  );
}
var STATE_BADGE = {
  connected: { text: "已连接", cls: "ok" },
  connecting: { text: "连接中", cls: "muted" },
  error: { text: "错误", cls: "err" },
  disabled: { text: "已停用", cls: "muted" }
};
function StatusBadge({ state, tools }) {
  const s = STATE_BADGE[state] ?? { text: state, cls: "muted" };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: `cc-badge cc-badge-${s.cls}`, children: [
    s.text,
    state === "connected" && tools > 0 ? ` · ${tools} 工具` : ""
  ] });
}
function Button({ kind = "secondary", disabled = false, onClick, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: `cc-btn cc-btn-${kind}`,
      disabled,
      onClick,
      children
    }
  );
}
function Drawer({ title, onClose, children, footer }) {
  if (!title) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cc-drawer-mask", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cc-drawer", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "cc-drawer-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "cc-drawer-title", children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, { onClick: onClose, children: "关闭" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cc-drawer-body", children }),
    footer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "cc-drawer-foot", children: footer }) : null
  ] }) });
}
function ErrorBar({ message }) {
  if (!message) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "cc-errorbar", role: "alert", children: message });
}

// src/client/McpTab.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;
function docToServers(value) {
  const out = [];
  for (const [serverName, entry] of Object.entries(value ?? {})) {
    out.push({ serverName, ...typeof entry === "object" && entry !== null ? entry : {} });
  }
  return out;
}
function McpTab({ scope }) {
  const [servers, setServers] = (0, import_react2.useState)([]);
  const [statuses, setStatuses] = (0, import_react2.useState)([]);
  const [error, setError] = (0, import_react2.useState)(null);
  const [editing, setEditing] = (0, import_react2.useState)(null);
  const [probeResult, setProbeResult] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    if (!scope) return;
    const adopt = () => setServers(docToServers(scope.getSnapshot().value));
    adopt();
    return scope.subscribe(adopt);
  }, [scope]);
  async function refresh() {
    try {
      const st = await rpc("mcpStatus");
      setStatuses(st.servers ?? []);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }
  (0, import_react2.useEffect)(() => {
    refresh();
    const t = setInterval(refresh, 8e3);
    return () => clearInterval(t);
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ErrorBar, { message: error }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "cc-row-actions", style: { margin: "4px 0 10px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "cc-card-sub", children: "MCP 配置即时生效（live），无需重启。" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { kind: "primary", onClick: () => openCreate(), children: "新增服务器" })
    ] }),
    servers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "cc-empty", children: "尚未配置任何 MCP 服务器。点击「新增服务器」接入第一个 server。" }) : servers.map((sv) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      ServerCard,
      {
        sv,
        status: statuses.find((s) => s.serverName === sv.serverName),
        onEdit: () => setEditing({ mode: "edit", draft: { ...sv } }),
        onToggle: () => toggle(sv),
        onDelete: () => del(sv),
        onProbe: () => probe(sv),
        probeResult: probeResult?.serverName === sv.serverName ? probeResult : null
      },
      sv.serverName
    )),
    editing ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      Editor,
      {
        editing,
        existing: servers.map((s) => s.serverName),
        onClose: () => setEditing(null),
        onSaved: () => {
          setEditing(null);
          refresh();
        }
      }
    ) : null
  ] });
  function openCreate() {
    setEditing({
      mode: "create",
      draft: { serverName: "", transport: "stdio", command: "", argsText: "", url: "", envPairs: [], headerPairs: [], enabled: true }
    });
  }
  async function mutate(ops) {
    const revision = scope?.getSnapshot?.().revision;
    await rpc("mcpMutate", { ops, ...typeof revision === "number" ? { expectedRevision: revision } : {} });
  }
  async function toggle(sv) {
    const next = !(sv.enabled !== false);
    if (next === false && !await confirmDialog(`停用 MCP 服务器「${sv.serverName}」？其工具将立即下线。`))
      return;
    try {
      await mutate([{ op: "set", path: [sv.serverName, "enabled"], value: next }]);
      refresh();
    } catch (e) {
      setError(errText(e));
    }
  }
  async function del(sv) {
    if (!await confirmDialog(`删除 MCP 服务器「${sv.serverName}」？此操作立即生效且不可撤销。`)) return;
    try {
      await mutate([{ op: "unset", path: [sv.serverName] }]);
      refresh();
    } catch (e) {
      setError(errText(e));
    }
  }
  async function probe(sv) {
    setProbeResult({ serverName: sv.serverName, loading: true });
    try {
      const candidate = sv.transport === "streamable-http" ? { transport: "streamable-http", url: sv.url ?? "", headers: {} } : { transport: "stdio", command: sv.command ?? "", args: sv.args ?? [] };
      const r = await rpc("testMcp", { candidate });
      setProbeResult({ serverName: sv.serverName, ...r });
    } catch (e) {
      setProbeResult({ serverName: sv.serverName, ok: false, error: errText(e) });
    }
  }
}
function ServerCard({ sv, status, onEdit, onToggle, onProbe, onDelete, probeResult }) {
  const enabled = sv.enabled !== false;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "cc-card" + (enabled ? "" : " cc-tr-disabled"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "cc-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "cc-card-title", children: sv.serverName }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StatusBadge, { state: status?.state ?? (enabled ? "connecting" : "disabled"), tools: status?.tools ?? 0 }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "cc-badge cc-badge-muted", children: sv.transport === "streamable-http" ? "http" : "stdio" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "cc-row-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: onProbe, children: "探活" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: onEdit, children: "编辑" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: onToggle, children: enabled ? "停用" : "启用" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { kind: "danger", onClick: onDelete, children: "删除" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "cc-card-sub", children: [
      sv.transport === "streamable-http" ? sv.url : `${sv.command ?? ""} ${(sv.args ?? []).join(" ")}`,
      probeResult ? probeResult.loading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: " · 探活中…" }) : probeResult.ok ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { color: "#2ea043" }, children: [
        " · 探活成功：",
        probeResult.tools,
        " 个工具",
        probeResult.sample?.length ? `（${probeResult.sample.join(", ")}…）` : ""
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { style: { color: "#f85149" }, children: [
        " · 探活失败：",
        probeResult.error
      ] }) : null
    ] })
  ] });
}
function pairsToOps(basePath, originalPairs, pairs, configuredKeys) {
  const ops = [];
  for (const p of pairs) {
    const key = p.k.trim();
    if (!key) continue;
    const isConfigured = configuredKeys.includes(key);
    if (isConfigured && (p.v ?? "") === "") continue;
    ops.push({ op: "set", path: [...basePath, key], value: p.v ?? "" });
  }
  for (const orig of originalPairs) {
    if (!orig.k.trim()) continue;
    const still = pairs.some((p) => p.k.trim() === orig.k.trim());
    if (!still && configuredKeys.includes(orig.k.trim())) {
      ops.push({ op: "unset", path: [...basePath, orig.k.trim()] });
    }
  }
  return ops;
}
function Editor({ editing, existing, onClose, onSaved }) {
  const isNew = editing.mode === "create";
  const [draft, setDraft] = (0, import_react2.useState)(
    () => editing.mode === "edit" ? {
      ...editing.draft,
      argsText: (editing.draft.args ?? []).join(" "),
      envPairs: [],
      envConfigured: [],
      // 异步由 mcpSecrets 填充（redacted 视图不含键名）
      headerPairs: [],
      headerConfigured: []
    } : editing.draft
  );
  const [invalid, setInvalid] = (0, import_react2.useState)({});
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [err, setErr] = (0, import_react2.useState)(null);
  (0, import_react2.useEffect)(() => {
    if (editing.mode !== "edit") return;
    let alive = true;
    rpc("mcpSecrets").then(({ secrets }) => {
      if (!alive || !Array.isArray(secrets)) return;
      const prefix = [editing.draft.serverName];
      const mine = secrets.filter((s) => s.path.length === prefix.length + 1 && s.path[0] === prefix[0]);
      const envKeys = mine.filter((s) => s.path[1] === "env").map((s) => ({ key: s.path[2], set: s.set }));
      const headerKeys = mine.filter((s) => s.path[1] === "headers").map((s) => ({ key: s.path[2], set: s.set }));
      setDraft((d) => ({
        ...d,
        envPairs: envKeys.map(({ key }) => ({ k: key, v: "" })),
        envConfigured: envKeys.filter(({ set: set2 }) => set2).map(({ key }) => key),
        headerPairs: headerKeys.map(({ key }) => ({ k: key, v: "" })),
        headerConfigured: headerKeys.filter(({ set: set2 }) => set2).map(({ key }) => key)
      }));
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, []);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  async function save() {
    const problems = {};
    if (!SERVER_NAME_RE.test(draft.serverName)) problems.serverName = "需匹配 [A-Za-z0-9_-]{1,32}";
    else if (isNew && existing.includes(draft.serverName)) problems.serverName = "名称已存在";
    if (draft.transport === "stdio" && !String(draft.command ?? "").trim()) problems.command = "stdio 必须填写 command";
    if (draft.transport === "streamable-http" && !/^https?:\/\//.test(String(draft.url ?? "")))
      problems.url = "必须为 http(s):// URL";
    setInvalid(problems);
    if (Object.keys(problems).length > 0) return;
    setBusy(true);
    setErr(null);
    try {
      const args = String(draft.argsText ?? "").split(/\s+/).filter(Boolean);
      if (isNew) {
        const kvOf = (pairs) => Object.fromEntries(
          pairs.filter((p) => p.k.trim() && (p.v ?? "") !== "").map((p) => [p.k.trim(), p.v])
        );
        const entry = draft.transport === "streamable-http" ? { transport: "streamable-http", url: draft.url, headers: kvOf(draft.headerPairs), enabled: true } : {
          transport: "stdio",
          command: draft.command,
          args,
          env: kvOf(draft.envPairs),
          enabled: true
        };
        await rpc("mcpMutate", { ops: [{ op: "set", path: [draft.serverName], value: entry }] });
      } else {
        const name = draft.serverName;
        const ops = [{ op: "set", path: [name, "transport"], value: draft.transport }];
        if (draft.transport === "stdio") {
          ops.push({ op: "set", path: [name, "command"], value: draft.command });
          ops.push({ op: "set", path: [name, "args"], value: args });
          ops.push(...pairsToOps([name, "env"], editing.draft.envPairs ?? [], draft.envPairs, editing.draft.envConfigured ?? []));
        } else {
          ops.push({ op: "set", path: [name, "url"], value: draft.url });
          ops.push(...pairsToOps([name, "headers"], editing.draft.headerPairs ?? [], draft.headerPairs, editing.draft.headerConfigured ?? []));
        }
        ops.push({ op: "set", path: [name, "enabled"], value: draft.enabled !== false });
        await rpc("mcpMutate", { ops });
      }
      onSaved();
    } catch (e) {
      setErr(errText(e));
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    Drawer,
    {
      title: isNew ? "新增 MCP 服务器" : `编辑 ${draft.serverName}`,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ErrorBar, { message: err }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { disabled: busy, onClick: onClose, children: "取消" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { kind: "primary", disabled: busy, onClick: save, children: busy ? "保存中…" : "保存" })
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "serverName（唯一标识，进入工具名 mcp__<name>__*）", hint: "[A-Za-z0-9_-]{1,32}", invalid: !!invalid.serverName, invalidText: invalid.serverName, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          TextInput,
          {
            value: draft.serverName,
            onChange: (v) => set({ serverName: v }),
            invalid: !!invalid.serverName,
            placeholder: "如 github / web-search"
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "传输方式", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("select", { className: "cc-input", value: draft.transport, onChange: (e) => set({ transport: e.target.value }), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "stdio", children: "stdio（本地子进程）" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("option", { value: "streamable-http", children: "streamable-http（远程服务）" })
        ] }) }),
        draft.transport === "stdio" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "command", hint: "可执行文件，如 npx / node / uvx", invalid: !!invalid.command, invalidText: invalid.command, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TextInput, { value: draft.command ?? "", onChange: (v) => set({ command: v }), invalid: !!invalid.command, placeholder: "npx" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "args（空格分隔）", hint: '如 "-y @modelcontextprotocol/server-github"', children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TextInput, { value: draft.argsText ?? "", onChange: (v) => set({ argsText: v }), placeholder: "-y @modelcontextprotocol/server-github" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            KVEditor,
            {
              label: "env 环境变量（值脱敏存储）",
              pairs: draft.envPairs ?? [],
              configured: draft.envConfigured ?? [],
              onPairs: (envPairs) => set({ envPairs }),
              secret: true
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "cwd（可选）", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TextInput, { value: draft.cwd ?? "", onChange: (v) => set({ cwd: v }) }) })
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Field, { label: "url", hint: "MCP 端点地址", invalid: !!invalid.url, invalidText: invalid.url, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TextInput, { value: draft.url ?? "", onChange: (v) => set({ url: v }), invalid: !!invalid.url, placeholder: "https://host/mcp" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            KVEditor,
            {
              label: "headers 请求头（值脱敏存储）",
              pairs: draft.headerPairs ?? [],
              configured: draft.headerConfigured ?? [],
              onPairs: (headerPairs) => set({ headerPairs }),
              secret: true
            }
          )
        ] })
      ]
    }
  );
}
function KVEditor({ label, pairs, configured, onPairs, secret }) {
  const update = (i, patch) => {
    const next = pairs.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    onPairs(next);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Field, { label, hint: secret ? "已配置的键留空即保持现值；填新值则覆盖" : void 0, children: [
    pairs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "cc-hint", children: "暂无条目" }) : null,
    pairs.map((p, i) => {
      const isSet = configured.includes(p.k.trim()) && p.k.trim() !== "";
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(TextInput, { value: p.k, onChange: (k) => update(i, { k }), placeholder: "KEY" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          TextInput,
          {
            type: "password",
            value: p.v,
            onChange: (v) => update(i, { v }),
            placeholder: isSet ? "已配置（留空保持）" : "VALUE"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: () => onPairs(pairs.filter((_, idx) => idx !== i)), children: "移除" })
      ] }, i);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Button, { onClick: () => onPairs([...pairs, { k: "", v: "" }]), children: "添加一项" }) })
  ] });
}

// src/client/PluginsTab.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var SOURCE_LABEL = { direct: "patch 直挂", insert: "insert 块", group: "group 子行" };
function PluginsTab({ onNeedsRestart, onCommentLost }) {
  const [bundles, setBundles] = (0, import_react3.useState)(null);
  const [doc, setDoc] = (0, import_react3.useState)(null);
  const [error, setError] = (0, import_react3.useState)(null);
  const [spec, setSpec] = (0, import_react3.useState)("");
  const [installing, setInstalling] = (0, import_react3.useState)(false);
  const [editing, setEditing] = (0, import_react3.useState)(null);
  const [creatingPatch, setCreatingPatch] = (0, import_react3.useState)(false);
  async function refreshBundles() {
    try {
      const d = await rpc("listBundles");
      setBundles(d);
    } catch (e) {
      setError(errText(e));
    }
  }
  async function refreshPatch() {
    try {
      const d = await rpc("listRows");
      setDoc(d);
    } catch (e) {
      setError(errText(e));
    }
  }
  async function refreshAll() {
    setError(null);
    await Promise.all([refreshBundles(), refreshPatch()]);
  }
  (0, import_react3.useEffect)(() => {
    refreshAll();
  }, []);
  async function doInstall() {
    const s = spec.trim();
    if (!s) {
      setError("请输入插件地址（见下方示例）");
      return;
    }
    setInstalling(true);
    setError(null);
    try {
      await rpc("installBundle", { spec: s });
      setSpec("");
      await refreshBundles();
      onNeedsRestart?.();
    } catch (e) {
      setError(errText(e));
    } finally {
      setInstalling(false);
    }
  }
  async function doRemoveBundle(name) {
    if (!await confirmDialog(`移除插件「${name}」？将执行 pnpm remove 并从 bundles 中移除，重启后生效。`)) return;
    setError(null);
    try {
      await rpc("removeBundle", { name });
      await refreshBundles();
      onNeedsRestart?.();
    } catch (e) {
      setError(errText(e));
    }
  }
  async function writePatchOp(method, args) {
    try {
      if (!doc) throw new Error("patch 列表尚未加载完成");
      const resp = await rpc(method, { ...args, expectedHash: doc.contentHash });
      if (resp.commentLost) onCommentLost?.();
      await refreshPatch();
      onNeedsRestart?.();
      return true;
    } catch (e) {
      setError(errText(e));
      return false;
    }
  }
  async function delPatch(row) {
    if (!await confirmDialog(`删除配置覆盖「${row.id}」（${row.name}）？将改写 cordis.patch.yml，重启后生效。`)) return;
    await writePatchOp("removeRow", { id: row.id });
  }
  async function togglePatch(row) {
    await writePatchOp("toggleRow", { id: row.id, disabled: !(row.disabled === true) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 18 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ErrorBar, { message: error }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { style: { margin: 0, fontSize: 14, fontWeight: 600 }, children: "已安装插件" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-hint", children: bundles ? `${bundles.bundles.length} 个 · ${bundles.profileDir}` : "加载中…" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "cc-card", style: { marginBottom: 10 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Field,
          {
            label: "安装插件 — 填入与 CLI 相同的 <spec>",
            hint: "支持三种写法，同 `dsh plugin --profile web add <spec>`",
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                TextInput,
                {
                  value: spec,
                  onChange: setSpec,
                  placeholder: "dsh-better-sidebar@0.15.0"
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { kind: "primary", disabled: installing, onClick: doInstall, children: installing ? "安装中…" : "安装" })
            ] })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "cc-hint", style: { lineHeight: 1.6 }, children: [
          "示例：",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: "dsh-better-sidebar@0.15.0" }),
          "（npm 带版本）",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: "~/dev/dsh-config-center" }),
          "（本地路径）",
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: "github:HanaAyane/dsh-reasoning-effort" }),
          "（GitHub，可加 #分支）"
        ] })
      ] }),
      !bundles ? null : bundles.bundles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "cc-empty", children: "尚未安装任何 bundle 插件。" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("table", { className: "cc-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "包名" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "来源 spec" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "操作" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tbody", { children: bundles.bundles.map((b) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("td", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { children: b.name }),
            b.inBox ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-badge cc-badge-muted", style: { marginLeft: 6 }, children: "InBox" }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" }, children: b.spec ?? "—" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: b.inBox ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-hint", children: "内置" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { kind: "danger", onClick: () => doRemoveBundle(b.name), children: "移除" }) })
        ] }, b.name)) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "cc-hint", style: { marginTop: 6 }, children: "安装/移除后需重启 Profile 生效；InBox 为模版自带、不可移除。" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h3", { style: { margin: 0, fontSize: 14, fontWeight: 600 }, children: "配置覆盖" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-hint", children: doc ? `${doc.flat.length} 条 · ${doc.patchPath}` : "加载中…" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { marginLeft: "auto" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => setCreatingPatch(true), children: "添加覆盖" }) })
      ] }),
      !doc ? null : doc.flat.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "cc-empty", children: "当前 patch 文件没有任何覆盖行（仅 modlens 等会显示在此）。" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("table", { className: "cc-table", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "id" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "name" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "来源" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "状态" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("th", { children: "操作" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("tbody", { children: doc.flat.map((row) => {
          const disabled = row.disabled === true;
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("tr", { className: disabled ? "cc-tr-disabled" : void 0, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: row.id }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { style: { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }, children: row.name }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "cc-badge cc-badge-muted", children: [
              SOURCE_LABEL[row.source] ?? row.source,
              row.groupId ? ` · ${row.groupId}` : ""
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: disabled ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-badge cc-badge-muted", children: "已禁用" }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "cc-badge cc-badge-ok", children: "启用" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "cc-row-actions", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => setEditing(row), children: "编辑" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: () => togglePatch(row), children: disabled ? "启用" : "禁用" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { kind: "danger", onClick: () => delPatch(row), children: "删除" })
            ] }) })
          ] }, row.id);
        }) })
      ] })
    ] }),
    creatingPatch ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      RowEditor,
      {
        title: "添加配置覆盖",
        initial: { id: "", name: "", configText: "{}", disabled: false },
        onClose: () => setCreatingPatch(false),
        onSave: async (draft) => {
          let config;
          try {
            config = JSON.parse(draft.configText || "{}");
          } catch {
            throw new Error("config 不是合法 JSON");
          }
          const ok = await writePatchOp("addRow", { row: { id: draft.id, name: draft.name, config, ...draft.disabled ? { disabled: true } : {} } });
          if (ok) setCreatingPatch(false);
        }
      }
    ) : null,
    editing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      RowEditor,
      {
        title: `编辑 ${editing.id}`,
        initial: { id: editing.id, name: editing.name, configText: JSON.stringify(editing.config ?? {}, null, 2), disabled: editing.disabled === true },
        onClose: () => setEditing(null),
        onSave: async (draft) => {
          let config;
          try {
            config = JSON.parse(draft.configText || "{}");
          } catch {
            throw new Error("config 不是合法 JSON");
          }
          const ok = await writePatchOp("updateRow", { id: editing.id, patch: { name: draft.name, config } });
          if (ok) setEditing(null);
        }
      }
    ) : null
  ] });
}
function RowEditor({ title, initial, onClose, onSave }) {
  const [draft, setDraft] = (0, import_react3.useState)(initial);
  const [err, setErr] = (0, import_react3.useState)(null);
  const [busy, setBusy] = (0, import_react3.useState)(false);
  const idInvalid = !/^[a-z0-9][a-z0-9-]*$/.test(draft.id);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    Drawer,
    {
      title,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ErrorBar, { message: err }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { onClick: onClose, children: "取消" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Button, { kind: "primary", disabled: busy, onClick: async () => {
          setBusy(true);
          setErr(null);
          try {
            await onSave(draft);
          } catch (e) {
            setErr(errText(e));
          } finally {
            setBusy(false);
          }
        }, children: busy ? "保存中…" : "保存" })
      ] }),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "id（唯一，[a-z0-9][a-z0-9-]*）", invalid: idInvalid, invalidText: "id 格式不合法", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TextInput, { value: draft.id, onChange: (v) => setDraft((d) => ({ ...d, id: v })), invalid: idInvalid, placeholder: "my-plugin" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "name（npm 包名或绝对路径）", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TextInput, { value: draft.name, onChange: (v) => setDraft((d) => ({ ...d, name: v })), placeholder: "@scope/pkg 或 /abs/path/index.js" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { label: "config（JSON）", hint: "插件的组合配置；非法 JSON 无法保存", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("textarea", { className: "cc-textarea", value: draft.configText, onChange: (e) => setDraft((d) => ({ ...d, configText: e.target.value })), spellCheck: false }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "cc-check", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { type: "checkbox", checked: draft.disabled, onChange: (e) => setDraft((d) => ({ ...d, disabled: e.target.checked })) }),
          " 禁用该项（保留配置）"
        ] })
      ]
    }
  );
}

// src/client/SkillsTab.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var ROOT_LABEL = {
  "project-dsh": "项目 .dsh",
  "project-agents": "项目 .agents",
  "user-dsh": "用户 ~/.dsh",
  "user-agents": "~/.agents"
};
function SkillsTab() {
  const [skills, setSkills] = (0, import_react4.useState)(null);
  const [error, setError] = (0, import_react4.useState)(null);
  const [editing, setEditing] = (0, import_react4.useState)(null);
  const [busyId, setBusyId] = (0, import_react4.useState)(null);
  async function refresh() {
    try {
      const r = await rpc("listSkills");
      setSkills(r.skills ?? []);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }
  (0, import_react4.useEffect)(() => {
    refresh();
  }, []);
  async function toggleFlag(skill, which) {
    setBusyId(skill.id + which);
    try {
      await rpc("setSkillFlags", {
        rootId: skill.rootId,
        id: skill.id,
        source: skill.source,
        ...which === "model" ? { modelVisible: !skill.modelVisible } : {},
        ...which === "user" ? { userInvocable: !skill.userInvocable } : {}
      });
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusyId(null);
    }
  }
  async function del(skill) {
    if (!await confirmDialog(
      `删除 Skill「${skill.id}」（${skill.path}）？该目录将被递归删除且不可恢复。`
    ))
      return;
    setBusyId(skill.id + "del");
    try {
      await rpc("removeSkill", { rootId: skill.rootId, id: skill.id, source: skill.source });
      await refresh();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusyId(null);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ErrorBar, { message: error }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "cc-row-actions", style: { margin: "4px 0 10px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "cc-card-sub", children: "开关与 SKILL.md 编辑均由 watcher 热生效；新增请在磁盘创建目录后点「刷新」。" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: refresh, children: "刷新" })
    ] }),
    !skills ? null : skills.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "cc-empty", children: "所有技能根均为空。" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: "cc-table", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "id" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "来源根" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "模型可见" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "用户可调" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "描述" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "操作" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: skills.map((s) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { className: s.broken ? "cc-tr-disabled" : void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("td", { children: [
          s.id,
          s.broken ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "cc-badge cc-badge-warn", style: { marginLeft: 6 }, children: "broken" }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "cc-badge " + (s.rootWritable ? "cc-badge-ok" : "cc-badge-muted"), children: [
          ROOT_LABEL[s.rootId] ?? s.rootId,
          " · rank",
          s.rank
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { disabled: !s.rootWritable || busyId === s.id + "model", onClick: () => toggleFlag(s, "model"), children: s.modelVisible ? "可见" : "隐藏" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { disabled: !s.rootWritable || busyId === s.id + "user", onClick: () => toggleFlag(s, "user"), children: s.userInvocable ? "可调" : "禁调" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { style: { maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: s.description ?? "—" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "cc-row-actions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: () => setEditing({ skill: s }), children: "编辑" }),
          s.rootWritable ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { kind: "danger", disabled: busyId === s.id + "del", onClick: () => del(s), children: "删除" }) : null
        ] }) })
      ] }, `${s.rootId}/${s.id}`)) })
    ] }),
    editing ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      SkillFileEditor,
      {
        skill: editing.skill,
        onClose: () => setEditing(null),
        onSaved: () => {
          setEditing(null);
          refresh();
        }
      }
    ) : null
  ] });
}
function SkillFileEditor({ skill, onClose, onSaved }) {
  const [state, setState] = (0, import_react4.useState)({ loading: true, content: "", hash: "", path: "", error: null });
  const [dirty, setDirty] = (0, import_react4.useState)(false);
  const [saving, setSaving] = (0, import_react4.useState)(false);
  const [saveErr, setSaveErr] = (0, import_react4.useState)(null);
  (0, import_react4.useEffect)(() => {
    let alive = true;
    rpc("readSkillFile", { rootId: skill.rootId, id: skill.id, source: skill.source }).then((r) => {
      if (!alive) return;
      setState({ loading: false, content: r.content ?? "", hash: r.hash ?? "", path: r.path ?? "", error: null });
    }).catch((e) => {
      if (!alive) return;
      setState({ loading: false, content: "", hash: "", path: "", error: errText(e) });
    });
    return () => {
      alive = false;
    };
  }, []);
  async function save() {
    setSaving(true);
    setSaveErr(null);
    try {
      const r = await rpc("writeSkillFile", {
        rootId: skill.rootId,
        id: skill.id,
        source: skill.source,
        content: state.content,
        expectedHash: state.hash
      });
      setState((s) => ({ ...s, hash: r.hash }));
      setDirty(false);
      onSaved?.();
    } catch (e) {
      setSaveErr(errText(e));
    } finally {
      setSaving(false);
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    Drawer,
    {
      title: `编辑 ${skill.id} — SKILL.md`,
      onClose,
      footer: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ErrorBar, { message: saveErr }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "cc-hint", style: { marginRight: "auto" }, children: [
          state.loading ? "" : dirty ? "有未保存改动 · " : "已保存 · ",
          "watcher 热生效"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { onClick: onClose, children: dirty ? "取消" : "关闭" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Button, { kind: "primary", disabled: !dirty || saving || state.loading || !!state.error, onClick: save, children: saving ? "保存中…" : "保存" })
      ] }),
      children: state.loading ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "cc-empty", children: "加载中…" }) : state.error ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ErrorBar, { message: state.error }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Field, { label: state.path, hint: "frontmatter 与正文均可编辑；保存即热生效", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "textarea",
          {
            className: "cc-textarea",
            style: { minHeight: 420, fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: 12.5 },
            value: state.content,
            spellCheck: false,
            readOnly: !skill.rootWritable,
            onChange: (e) => {
              setState((s) => ({ ...s, content: e.target.value }));
              setDirty(true);
            }
          }
        ) }),
        !skill.rootWritable ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "cc-warnbar", children: [
          "该技能位于只读根（",
          ROOT_LABEL[skill.rootId] ?? skill.rootId,
          "），仅可查看。"
        ] }) : null
      ] })
    }
  );
}

// src/client/style.js
function injectCss() {
  if (typeof document === "undefined") return;
  const TAG_ID = "dsh-config-center/css";
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`)) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-config-center";
  tag.dataset.pluginCss = TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
var CSS = `
.cc-section{max-width:880px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:12px}
.cc-heading{margin:0;font-size:18px;font-weight:600}
.cc-intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:1.5}
.cc-tabs{display:flex;gap:22px;align-items:flex-end;border-bottom:1px solid var(--dsw-alias-border-l2)}
.cc-tab{background:none;border:0;cursor:pointer;font:inherit;color:var(--dsw-alias-label-tertiary);padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.cc-tab:hover{color:var(--dsw-alias-label-primary)}
.cc-tab[data-active="true"]{color:var(--dsw-alias-label-primary)}
.cc-tab[data-active="true"]::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px 2px 0 0;background:var(--dsw-alias-label-primary)}
.cc-panel{padding-top:10px;min-width:0;display:flex;flex-direction:column;gap:10px}
.cc-empty{color:var(--dsw-alias-label-tertiary);font-size:13px;margin:0}

/* 卡片与表格 */
.cc-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}
.cc-card-head{display:flex;align-items:center;gap:10px}
.cc-card-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cc-card-sub{color:var(--dsw-alias-label-tertiary);font-size:12.5px;line-height:1.5}
.cc-row-actions{display:flex;gap:8px;align-items:center;margin-left:auto}
.cc-table{width:100%;border-collapse:collapse;font-size:13px}
.cc-table th{text-align:left;color:var(--dsw-alias-label-tertiary);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.cc-table td{padding:8px;border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);word-break:break-all}
.cc-tr-disabled td{opacity:.45}

/* 徽标 */
.cc-badge{white-space:nowrap;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}
.cc-badge-ok{background:rgba(46,160,67,.15);color:#2ea043}
.cc-badge-muted{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}
.cc-badge-err{background:rgba(248,81,73,.12);color:#f85149}
.cc-badge-warn{background:rgba(210,153,34,.14);color:#d29922}

/* 按钮 */
.cc-btn{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5;border:1px solid transparent;white-space:nowrap;flex:none}
.cc-btn-secondary{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:none}
.cc-btn-secondary:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}
.cc-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.cc-btn-danger{border-color:rgba(248,81,73,.4);color:#f85149;background:none}
.cc-btn:disabled{opacity:.4;cursor:default}

/* 表单字段 */
.cc-field{display:flex;flex-direction:column;gap:6px;padding:10px 0}
.cc-field+.cc-field{border-top:1px solid var(--dsw-alias-border-l2)}
.cc-field-head{display:flex;align-items:center;gap:8px}
.cc-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}
.cc-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;width:100%;box-sizing:border-box;flex:1;min-width:0}
.cc-input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}
.cc-input-invalid,.cc-input-invalid:focus-visible{border-color:#f85149}
.cc-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5}
.cc-invalid{color:#f85149;margin:0;font-size:12px;line-height:1.5}
.cc-textarea{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;min-height:110px;width:100%;box-sizing:border-box}
.cc-check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--dsw-alias-label-primary)}

/* 抽屉 */
.cc-drawer-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:60;display:flex;justify-content:flex-end}
.cc-drawer{width:min(480px,92vw);height:100%;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:-8px 0 32px rgba(0,0,0,.25);display:flex;flex-direction:column}
.cc-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.cc-drawer-title{font-size:15px;font-weight:600}
.cc-drawer-body{padding:8px 20px;overflow:auto;flex:1}
.cc-drawer-foot{padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l2);display:flex;gap:8px;justify-content:flex-end}

/* 提示条 */
.cc-errorbar{background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.35);color:#f85149;border-radius:8px;padding:8px 12px;font-size:12.5px;margin:0}
.cc-warnbar{background:rgba(210,153,34,.12);border:1px solid rgba(210,153,34,.4);color:#d29922;border-radius:8px;padding:8px 12px;font-size:12.5px;margin:0;display:flex;gap:10px;align-items:center}
/* ---- 侧栏底部入口（对齐 settings.trigger 视觉）---- */
.cc-foot-entry{appearance:none;background:0 0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:10px;height:36px;justify-content:center;align-items:center;gap:9px;padding:0 10px;display:flex;width:100%;min-width:0;font:inherit;font-size:13.5px}
.cc-foot-entry:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.cc-foot-entry.is-wide{padding:0 4px}
.cc-foot-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* ---- 管理中心弹窗（shell.overlay，对齐官方 Settings 弹窗视觉，尺寸放大）---- */
.cc-dialog-overlay{z-index:1000;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}
.cc-dialog-mask{background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute;inset:0}
.cc-dialog-panel{z-index:1;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);width:min(1240px,calc(100vw - 64px));height:min(880px,100vh - 64px);box-shadow:var(--dsw-shadow-lv3);border-radius:24px;display:flex;flex-direction:column;position:relative;overflow:hidden;font-size:14px}
.cc-page-head{flex:none;display:flex;align-items:center;gap:24px;padding:18px 32px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.cc-page-title{display:flex;align-items:center;gap:10px;padding-bottom:14px}
.cc-page-title h1{margin:0;font-size:17px;font-weight:600;line-height:24px}
.cc-tabs-page{border-bottom:none}
.cc-tabs-page .cc-tab{padding:10px 2px 12px;font-size:13.5px}
.cc-page-close{margin-left:auto;appearance:none;background:0 0;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:15px;width:30px;height:30px;border-radius:50%;display:inline-flex;justify-content:center;align-items:center;margin-bottom:8px}
.cc-page-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.cc-page-body{flex:1;overflow:auto;padding:22px 32px 40px}
.cc-section-page{max-width:1080px;margin:0 auto}

`;

// src/client.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var inject = ["slots", "settingsScope"];
var overlayStore = {
  open: false,
  listeners: /* @__PURE__ */ new Set(),
  getSnapshot() {
    return this.open;
  },
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  },
  setOpen(v) {
    if (this.open === v) return;
    this.open = v;
    this.listeners.forEach((fn) => fn(this.open));
  }
};
function useOverlayOpen() {
  const [open, setOpen] = (0, import_react5.useState)(() => overlayStore.getSnapshot());
  (0, import_react5.useEffect)(() => overlayStore.subscribe(() => setOpen(overlayStore.getSnapshot())), []);
  return [open, (v) => overlayStore.setOpen(v)];
}
function ExtensionsIcon({ size = 16 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("svg", { width: size, height: size, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.3", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M6.2 1.8h3.1v2.1a1.35 1.35 0 1 0 2.7 0V1.8h2.2v3.1h-2.1a1.35 1.35 0 1 0 0 2.7h2.1v3.1h-2.1a1.35 1.35 0 1 0 0 2.7h2.1v3.6H1.7V1.8h4.5z", strokeLinejoin: "round" }) });
}
function FooterEntry({ wide }) {
  const [, setOpen] = useOverlayOpen();
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "button",
    {
      type: "button",
      className: "cc-foot-entry" + (wide ? " is-wide" : ""),
      title: "扩展管理中心",
      onClick: () => setOpen(true),
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ExtensionsIcon, { size: wide ? 16 : 18 }),
        wide ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "cc-foot-label", children: "扩展管理中心" }) : null
      ]
    }
  );
}
var TABS = [
  { id: "plugins", label: "插件" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" }
];
function ManagerPage({ scope, onClose }) {
  const [active, setActive] = (0, import_react5.useState)("plugins");
  const [needsRestart, setNeedsRestart] = (0, import_react5.useState)(false);
  const [commentLost, setCommentLost] = (0, import_react5.useState)(false);
  (0, import_react5.useEffect)(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "cc-dialog-overlay", onClick: onClose, role: "presentation", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "cc-dialog-mask" }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "cc-dialog-panel", role: "dialog", "aria-modal": "true", "aria-label": "扩展管理中心", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("header", { className: "cc-page-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "cc-page-title", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ExtensionsIcon, { size: 18 }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("h1", { children: "扩展管理中心" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "cc-tabs cc-tabs-page", role: "tablist", children: TABS.map((tab) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            className: "cc-tab",
            "data-active": tab.id === active ? "true" : void 0,
            onClick: () => setActive(tab.id),
            children: tab.label
          },
          tab.id
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "cc-page-close", title: "关闭 (Esc)", onClick: onClose, children: "✕" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("main", { className: "cc-page-body", children: [
        needsRestart || commentLost ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }, children: [
          commentLost ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "cc-warnbar", role: "status", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "本次写入未保留 patch 文件中/尾部注释（头部注释已保留），原文备份于 cordis.patch.yml.bak。" }) }) : null,
          needsRestart ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "cc-warnbar", role: "status", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: "配置已写入 — 重启 Profile 后生效：" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { children: "dsh --profile web 重启" })
          ] }) : null
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "cc-section cc-section-page", children: [
          active === "plugins" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(PluginsTab, { onNeedsRestart: () => setNeedsRestart(true), onCommentLost: () => setCommentLost(true) }),
          active === "skills" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SkillsTab, {}),
          active === "mcp" && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(McpTab, { scope })
        ] })
      ] })
    ] })
  ] });
}
function OverlayHost({ scope }) {
  const [open] = useOverlayOpen();
  if (!open) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ManagerPage, { scope, onClose: () => overlayStore.setOpen(false) });
}
function apply(ctx) {
  injectCss();
  const slots = ctx.get("slots");
  if (slots === void 0) return;
  let scope = null;
  try {
    scope = ctx.settingsScope?.bind ? ctx.settingsScope.bind({ namespace: "mcp-center" }) : null;
  } catch {
  }
  slots.inject(
    "sidebar.footer.action",
    () => slots.register({ name: "sidebar.footer.action", id: "config-center-entry", order: 10 }, FooterEntry)
  );
  slots.inject(
    "shell.overlay",
    () => slots.register({ name: "shell.overlay", id: "config-center-page", order: 50 }, OverlayHost)
  );
}
return module.exports;}});
//# sourceMappingURL=client.js.map
