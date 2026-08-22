/**
 * Host RPC 集成测试 — 真 HTTP 栈实测 /api/config-center/* 端点
 * （apply 同步段注册路由 → 临时 http server 承载 → fetch 断言）
 */
import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { writeFile, readFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { withTempDir } from "./helpers.mjs"

/** 把插件 host 半挂到一个真 http server 上 */
async function bootHost(config) {
  const routes = new Map()
  const ctx = {
    webServer: {
      register: ({ path, handler }) => {
        routes.set(path, handler)
        return () => routes.delete(path)
      },
    },
    logger: { info() {}, warn(...a) { console.warn("[warn]", ...a) } },
    // settings 服务缺席：注入回调挂起（真实宿主中 mcpApi 将为 null）
    inject() {},
    on() { return () => {} },
    effect(fn) { fn(); return () => {} },
    get() { return undefined },
    settingsScope: undefined,
  }
  const mod = await import("../src/index.js")
  mod.apply(ctx, { patchPath: "", skillsRoot: "", maxPatchBytes: 1 << 20, projectRoot: "", customSkillDirs: [] })
  const server = createServer(async (req, res) => {
    const h = routes.get(new URL(req.url ?? "/", "http://x").pathname)
    if (!h) {
      res.writeHead(404).end()
      return
    }
    await h(req, res)
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const port = server.address().port
  return {
    base: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((r) => server.close(r))
    },
  }
}

test("ping endpoint answers over real HTTP", async (t) => {
  const host = await bootHost({})
  t.after(() => host.close())
  const r = await (await fetch(`${host.base}/api/config-center/ping`)).json()
  assert.equal(r.ok, true)
  assert.equal(r.name, "dsh-config-center")
})

test("mcpMutate without settings service fails soft (503)", async (t) => {
  const host = await bootHost({})
  t.after(() => host.close())
  const res = await fetch(`${host.base}/api/config-center/mcpMutate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ops: [] }),
  })
  assert.equal(res.status, 503)
})

test("listRows reads a real patch file; addRow→removeRow round-trips with hash fence", async (t) => {
  await withTempDir(t, async (dir) => {
    const patch = join(dir, "cordis.patch.yml")
    await writeFile(patch, "- insert:\n    - id: seed\n      name: seed-plugin\n")
    process.env.DSH_HOME = dir
    try {
      // resolvePatchPath 开发态：profiles 下唯一候选；这里直接显式给路径更稳
      const routes = new Map()
      const ctx = makeCtxWithRoutes(routes)
      const mod = await import("../src/index.js")
      mod.apply(ctx, { patchPath: patch, maxPatchBytes: 1 << 20, projectRoot: "", customSkillDirs: [], skillsRoot: "" })
      const server = createServer((req, res) => {
        const h = routes.get(new URL(req.url ?? "/", "http://x").pathname)
        if (!h) return res.writeHead(404).end()
        Promise.resolve(h(req, res)).catch(() => {})
      })
      await new Promise((r) => server.listen(0, "127.0.0.1", r))
      t.after(() => server.close())
      const base = `http://127.0.0.1:${server.address().port}`
      const post = async (method, args) =>
        (
          await fetch(`${base}/api/config-center/${method}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args),
          })
        ).json()

      const l1 = await (await fetch(`${base}/api/config-center/listRows`)).json()
      assert.equal(l1.ok, true)
      assert.equal(l1.flat.length, 1)
      assert.equal(l1.flat[0].id, "seed")
      assert.equal(l1.flat[0].source, "insert")

      // hash 围栏：错误 expectedHash → 409
      const bad = await post("addRow", { row: { id: "demo", name: "demo-plugin", config: {} }, expectedHash: "deadbeef" })
      assert.equal(bad.ok, false)

      // 正确围栏：新增 → 校验文件内容 → 删除 → 空壳清理
      const added = await post("addRow", { row: { id: "demo", name: "demo-plugin", config: {} }, expectedHash: l1.contentHash })
      assert.equal(added.ok, true)
      const text = await readFile(patch, "utf8")
      assert.ok(text.includes("demo"))
      const bak = await readFile(`${patch}.bak`, "utf8")
      assert.ok(bak.includes("seed"))

      const removed = await post("removeRow", { id: "demo", expectedHash: added.contentHash })
      assert.equal(removed.ok, true)
      const after = await readFile(patch, "utf8")
      assert.ok(!after.includes("demo"))
      assert.ok(after.includes("seed"))
    } finally {
      delete process.env.DSH_PROFILE
    }
  })
})

test("listSkills scans the user root over HTTP", async (t) => {
  await withTempDir(t, async (dir) => {
    const skillsDir = join(dir, "skills")
    await mkdir(join(skillsDir, "my-skill"), { recursive: true })
    await writeFile(join(skillsDir, "my-skill", "SKILL.md"), "---\nname: my-skill\ndescription: 测试技能\n---\nbody")
    const routes = new Map()
    const ctx = makeCtxWithRoutes(routes)
    const mod = await import("../src/index.js")
    mod.apply(ctx, { patchPath: join(dir, "none.yml"), maxPatchBytes: 1 << 20, projectRoot: "", customSkillDirs: [], skillsRoot: "" })
    // 注入 DSH_HOME 使 user-dsh 根指向临时目录
    const oldHome = process.env.DSH_HOME
    process.env.DSH_HOME = dir
    const server = createServer((req, res) => {
      const h = routes.get(new URL(req.url ?? "/", "http://x").pathname)
      if (!h) return res.writeHead(404).end()
      Promise.resolve(h(req, res)).catch(() => {})
    })
    await new Promise((r) => server.listen(0, "127.0.0.1", r))
    t.after(() => server.close())
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/config-center/listSkills`)
    const body = await res.json()
    process.env.DSH_HOME = oldHome
    assert.equal(body.ok, true)
    const mine = body.skills.find((s) => s.id === "my-skill")
    assert.ok(mine, "user skill discovered")
    assert.equal(mine.rootId, "user-dsh")
    assert.equal(mine.modelVisible, true)
  })
})

function makeCtxWithRoutes(routes) {
  return {
    webServer: {
      register: ({ path, handler }) => {
        routes.set(path, handler)
        return () => routes.delete(path)
      },
    },
    logger: { info() {}, warn() {} },
    inject(_n, cb) { /* settings 不挂载 */ },
    on() { return () => {} },
    effect(fn) { fn(); return () => {} },
    get() { return undefined },
  }
}
