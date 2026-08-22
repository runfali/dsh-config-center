/**
 * mcp-supervisor 单元测试 — mock ctx
 * 重点覆盖：rebuild 串行化（防 watch 高频触发交错）/ 幽灵状态清理 / dispose 级联
 */
import test from "node:test"
import assert from "node:assert/strict"
import { createSupervisor, buildClientConfig } from "../src/mcp-supervisor.js"

function makeCtx({ toolNames = [], mountDelayMs = 0 } = {}) {
  const fibers = []
  return {
    fibers,
    ctx: {
      isolate(label) {
        void label
        return {
          plugin(p, cfg) {
            const f = { name: p.name, cfg, disposed: false }
            const promise = new Promise((resolve) => setTimeout(() => resolve(f), mountDelayMs))
            fibers.push(f)
            return Object.assign(promise.then(() => f), {
              dispose: async () => {
                await promise
                f.disposed = true
              },
            })
          },
        }
      },
      get(k) {
        return k === "tools"
          ? { schemas: () => toolNames.map((name) => ({ name })) }
          : undefined
      },
      on() {
        return () => {}
      },
      effect(fn) {
        fn()
        return () => {}
      },
    },
    logger: { info() {}, warn(...a) { console.warn("[warn]", ...a) } },
  }
}

test("buildClientConfig strips enabled and injects serverName", () => {
  assert.deepEqual(
    buildClientConfig("gh", { transport: "stdio", command: "npx", enabled: false, env: { A: "b" } }),
    { transport: "stdio", command: "npx", env: { A: "b" }, serverName: "gh" },
  )
})

test("rebuild serializes concurrent calls; final state matches latest doc only", async () => {
  const { ctx, logger, fibers } = makeCtx({ mountDelayMs: 20 })
  const sup = createSupervisor(ctx, logger)
  // 三次快速触发：a → a+b → b（模拟 watch 高频突发）
  sup.rebuild({ a: { transport: "stdio", command: "x", enabled: true } })
  sup.rebuild({ a: { transport: "stdio", command: "x", enabled: true }, b: { transport: "stdio", command: "y", enabled: true } })
  const last = sup.rebuild({ b: { transport: "stdio", command: "y", enabled: true } })
  await last
  await new Promise((r) => setTimeout(r, 50))
  const names = fibers.filter((f) => !f.disposed).map((f) => f.name).sort()
  assert.deepEqual(names, ["config-center/mcp-b"])
  const st = sup.statusList({ b: { transport: "stdio" } })
  assert.equal(st.length, 1)
  assert.equal(st[0].serverName, "b")
})

test("removed server leaves no ghost status row", async () => {
  const { ctx, logger, fibers } = makeCtx()
  const sup = createSupervisor(ctx, logger)
  await sup.rebuild({ a: { transport: "stdio", command: "x", enabled: true }, gone: { transport: "stdio", command: "g", enabled: true } })
  await new Promise((r) => setTimeout(r, 10))
  await sup.rebuild({ a: { transport: "stdio", command: "x", enabled: true } })
  await new Promise((r) => setTimeout(r, 10))
  const st = sup.statusList({ a: { transport: "stdio" } })
  assert.deepEqual(st.map((s) => s.serverName), ["a"])
})

test("disabled entries never mount but keep status", async () => {
  const { ctx, logger, fibers } = makeCtx()
  const sup = createSupervisor(ctx, logger)
  await sup.rebuild({ off: { transport: "stdio", command: "x", enabled: false } })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(fibers.length, 0)
  const st = sup.statusList({ off: { transport: "stdio", enabled: false } })
  assert.equal(st[0].state, "disabled")
})

test("dispose tears down all fibers and blocks later rebuilds", async () => {
  const { ctx, logger, fibers } = makeCtx()
  const sup = createSupervisor(ctx, logger)
  await sup.rebuild({ a: { transport: "stdio", command: "x", enabled: true } })
  await new Promise((r) => setTimeout(r, 10))
  await sup.dispose()
  assert.equal(fibers.every((f) => f.disposed), true)
  await sup.rebuild({ z: { transport: "stdio", command: "z", enabled: true } })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(fibers.filter((f) => f.name.includes("mcp-z")).length, 0)
})
