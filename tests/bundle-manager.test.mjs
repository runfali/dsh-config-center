/**
 * bundle-manager 单元测试 — 列举/解析（不实际跑 pnpm）
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { homedir } from "node:os"
import { withTempDir } from "./helpers.mjs"
import { listBundles, readBundleState, resolveProfileDir } from "../src/bundle-manager.js"

test("resolveProfileDir: patchPath reverse-derivation > DSH_PROFILE > default web", () => {
  assert.equal(resolveProfileDir("/x/profiles/foo/cordis.patch.yml", {}), "/x/profiles/foo")
  assert.equal(resolveProfileDir("", { DSH_HOME: "/h", DSH_PROFILE: "bar" }), "/h/profiles/bar")
  assert.equal(resolveProfileDir("", {}), join(process.env.DSH_HOME || homedir() + "/.dsh", "profiles/web"))
})

test("listBundles marks inBox vs dependency bundles with spec provenance", async (t) => {
  await withTempDir(t, async (dir) => {
    const nm = join(dir, "node_modules", "my-bundle")
    await mkdir(nm, { recursive: true })
    await writeFile(join(nm, "package.json"), JSON.stringify({ name: "my-bundle", dsh: { bundle: { patch: "./cordis.patch.yml" } } }))
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({
        dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "my-bundle"] } },
        dependencies: { "my-bundle": "0.1.0" },
      }),
    )
    const items = listBundles(dir)
    assert.equal(items.length, 2)
    const inBox = items.find((i) => i.name === "@deepseek-ai/dsh-base")
    assert.equal(inBox.inBox, true)
    assert.equal(inBox.spec, null)
    const dep = items.find((i) => i.name === "my-bundle")
    assert.equal(dep.inBox, false)
    assert.equal(dep.spec, "0.1.0")
    assert.equal(dep.isBundle, true)
  })
})

test("readBundleState tolerates missing/corrupt package.json", async (t) => {
  await withTempDir(t, async (dir) => {
    const s = readBundleState(dir)
    assert.deepEqual(s.bundles, [])
    await writeFile(join(dir, "package.json"), "{broken")
    const s2 = readBundleState(dir)
    assert.deepEqual(s2.bundles, [])
  })
})
