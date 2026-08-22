/**
 * bundle-manager — profile bundles (package.json) 的列举与 pnpm 安装/移除
 * 对齐 @deepseek-ai/dsh/lib/plugin-9h8shc4d.js 的 reconcile + anchor 语义，
 * 但作为 Host RPC 供 config-center 的 UI 调用。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { homedir } from "node:os"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)

/** 从 profileDir 读 package.json（含 dsh.profile.bundles + dependencies） */
export function readBundleState(profileDir) {
  const p = join(profileDir, "package.json")
  if (!existsSync(p)) return { bundles: [], dependencies: {}, raw: null, path: p }
  const raw = readFileSync(p, "utf8")
  let j
  try { j = JSON.parse(raw) } catch { return { bundles: [], dependencies: {}, raw, path: p } }
  const bundles = j?.dsh?.profile?.bundles ?? []
  const deps = j?.dependencies ?? {}
  return { bundles, dependencies: deps, raw: j, path: p }
}

/** 判断已装依赖是否为 dsh bundle（看其包的 package.json dsh.bundle.patch） */
export function isInstalledBundle(packageName, profileDir) {
  try {
    // 解析 profileDir 起：和 pnpm 同 cwd 解析一致
    const pkgDir = resolveBundleDirShim(packageName, profileDir)
    const mf = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"))
    return mf?.dsh?.bundle?.patch !== undefined
  } catch { return false }
}

// 复刻 @deepseek-ai/dsh-app-boot resolveBundleDir 的最简可用版：
// 按 node 模块解析从 profileDir 向父级找 node_modules/<name>/package.json
function resolveBundleDirShim(packageName, profileDir) {
  // 先试 profileDir/node_modules/<name>
  const cand = join(profileDir, "node_modules", packageName)
  if (existsSync(join(cand, "package.json"))) return cand
  // pnpm link 场景：.pnpm 虚拟存储仍可经 profileDir 解析——用 require.resolve 兜底
  try {
    const resolved = require.resolve(join(packageName, "package.json"), { paths: [profileDir] })
    return join(resolved, "..")
  } catch {}
  throw new Error(`bundle not found: ${packageName}`)
}

/** 列出所有已装 bundles（含 spec 与是否 InBox） */
export function listBundles(profileDir) {
  const { bundles, dependencies } = readBundleState(profileDir)
  return bundles.map((name) => {
    const spec = dependencies[name] ?? null  // null 表示 InBox（非 dependency）
    const isBundle = spec === null ? true : isInstalledBundle(name, profileDir)
    return { name, spec, inBox: spec === null, isBundle }
  })
}

/** 推断 profile 目录（显式配置 > DSH_PROFILE env > 默认 web） */
export function resolveProfileDir(explicitPatchPath, env = process.env) {
  if (explicitPatchPath && String(explicitPatchPath).trim() !== "") {
    // 从 patchPath 反推 profileDir：.../profiles/<name>/cordis.patch.yml
    const m = /^(.*\/profiles\/[^/]+)\/cordis\.patch\.yml$/.exec(String(explicitPatchPath))
    if (m) return m[1]
  }
  if (env.DSH_PROFILE) return join(env.DSH_HOME || join(homedir(), ".dsh"), "profiles", env.DSH_PROFILE)
  return join(env.DSH_HOME || join(homedir(), ".dsh"), "profiles", "web")
}

// anchor 逻辑与 CLI 一致：相对路径 specs 锚到调用者 cwd
function anchorPathSpec(argument, cwd) {
  const match = /^(?<prefix>(?:file|link):)?(?<path>\.{1,2}(?:[/\\].*)?)$/.exec(argument)
  if (match?.groups?.path === undefined) return argument
  return `${match.groups.prefix ?? ""}${resolve(cwd, match.groups.path)}`
}

/** 执行 pnpm <args>（cwd=profileDir），返回 {code, stderr} */
function runPnpm(profileDir, args, cwdHint = process.cwd()) {
  const anchored = args.map((a) => anchorPathSpec(a, cwdHint))
  const result = spawnSync("pnpm", anchored, { cwd: profileDir, encoding: "utf8", shell: process.platform === "win32" })
  if (result.error?.code === "ENOENT") throw new Error("pnpm not found on PATH — install pnpm to manage profile plugins")
  return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr, error: result.error }
}

function reconcilePlugins(profileDir, before) {
  const after = JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8"))
  const beforeDeps = new Set(Object.keys(before?.dependencies ?? {}))
  const deps = Object.keys(after.dependencies ?? {})
  const plugins = after.dsh?.profile?.bundles ?? []
  let changed = false
  for (const name of deps) {
    const isBundle = isInstalledBundle(name, profileDir)
    if (isBundle && !plugins.includes(name)) { plugins.push(name); changed = true }
  }
  const depSet = new Set(deps)
  for (const name of [...plugins]) {
    const wasDep = beforeDeps.has(name) || depSet.has(name)
    const stillBundle = depSet.has(name) && isInstalledBundle(name, profileDir)
    if (wasDep && !stillBundle) { plugins.splice(plugins.indexOf(name), 1); changed = true }
  }
  if (!changed) return
  after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles: plugins } }
  writeFileSync(join(profileDir, "package.json"), JSON.stringify(after, null, 2) + "\n", "utf8")
}

/** UI 调用的安装：dsh plugin add <spec> 语义（支持 pnpm 队列：调用方自行串行） */
export function installBundle(spec, profileDir, cwdHint) {
  if (!spec || !String(spec).trim()) throw new Error("plugin spec is required — e.g. dsh-better-sidebar@0.15.0")
  const before = (() => { try { return JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8")) } catch { return {} } })()
  const { code, stdout, stderr } = runPnpm(profileDir, ["add", String(spec).trim()], cwdHint)
  if (code !== 0) {
    const hint = /git\+|^github:|\.git(?:#|$)/.test(String(spec)) ? "\ngithub 插件若提示 allowBuilds，按 pnpm 输出把 allowBuilds 加入 pnpm-workspace.yaml 后重试" : ""
    throw Object.assign(new Error((stderr || stdout || `pnpm add failed (code ${code})`) + hint), { code, stdout, stderr })
  }
  reconcilePlugins(profileDir, before)
  return { ok: true, stdout, stderr }
}

/** 移除：dsh plugin remove <name> */
export function removeBundle(packageName, profileDir) {
  if (!packageName) throw new Error("package name required")
  const before = (() => { try { return JSON.parse(readFileSync(join(profileDir, "package.json"), "utf8")) } catch { return {} } })()
  const { code, stdout, stderr } = runPnpm(profileDir, ["remove", String(packageName).trim()])
  if (code !== 0) throw Object.assign(new Error(stderr || stdout || `pnpm remove failed (code ${code})`), { code, stdout, stderr })
  try { reconcilePlugins(profileDir, before) } catch {}
  return { ok: true, stdout, stderr }
}
