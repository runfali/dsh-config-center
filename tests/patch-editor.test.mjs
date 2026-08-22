/**
 * patch-editor 单元测试 — node --test
 * 覆盖：路径解析 / 读取校验 / 结构感知行操作 / !!js 拦截 / 原子写 / 序列化往返
 */
import test from "node:test"
import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { withTempDir } from "./helpers.mjs"
import {
  addRow,
  contentHash,
  containsJsTags,
  listEntries,
  readPatchDoc,
  removeRow,
  replaceRows,
  resolvePatchPath,
  serializeRows,
  setFsProbe,
  toggleRow,
  updateRow,
  validateRows,
  writePatchAtomic,
} from "../src/patch-editor.js"

test("contentHash is stable and length-bounded", () => {
  const h1 = contentHash(Buffer.from("abc"))
  assert.equal(h1, contentHash(Buffer.from("abc")))
  assert.notEqual(h1, contentHash(Buffer.from("abd")))
  assert.equal(h1.length, 16)
})

test("resolvePatchPath: explicit config wins", () => {
  assert.equal(resolvePatchPath({ patchPath: "/x/y.yml" }, "file:///a/src/index.js", "/home", {}), "/x/y.yml")
})

test("resolvePatchPath: DSH_PROFILE env", () => {
  assert.equal(resolvePatchPath({}, "", "/dsh-home", { DSH_PROFILE: "web" }), "/dsh-home/profiles/web/cordis.patch.yml")
})

test("resolvePatchPath: bundle install layout reverse-derivation", () => {
  const selfUrl = "file:///dsh/profiles/web/node_modules/dsh-config-center/src/index.js"
  assert.equal(resolvePatchPath({}, selfUrl, "/dsh", {}), "/dsh/profiles/web/cordis.patch.yml")
})

test("resolvePatchPath: dev mode single candidate auto-detect", () => {
  setFsProbe({
    readdirSync: () => ["alpha", "empty"],
    existsSync: (p) => String(p).includes("alpha"),
  })
  try {
    assert.equal(
      resolvePatchPath({}, "file:///data/proj/src/index.js", "/dsh", {}),
      "/dsh/profiles/alpha/cordis.patch.yml",
    )
  } finally {
    setFsProbe(null)
  }
})

test("resolvePatchPath: ambiguous candidates throw with guidance", () => {
  setFsProbe({
    readdirSync: () => ["a", "b"],
    existsSync: () => true,
  })
  try {
    assert.throws(() => resolvePatchPath({}, "file:///x/src/index.js", "/dsh", {}), /patchPath/)
  } finally {
    setFsProbe(null)
  }
})

test("readPatchDoc parses loader dialect and computes hash", async (t) => {
  await withTempDir(t, async (dir) => {
    const file = `${dir}/cordis.patch.yml`
    await writeFile(file, "- insert:\n    - id: a\n      name: x\n")
    const doc = await readPatchDoc(file, 1024 * 1024)
    assert.equal(doc.rows.length, 1)
    assert.equal(doc.rows[0].insert[0].id, "a")
    assert.match(doc.hash, /^[0-9a-f]{16}$/)
  })
})

test("readPatchDoc rejects invalid yaml", async (t) => {
  await withTempDir(t, async (dir) => {
    const file = `${dir}/bad.yml`
    await writeFile(file, "- {unbalanced\n")
    await assert.rejects(() => readPatchDoc(file, 1 << 20), /valid YAML/)
  })
})

test("listEntries sees direct / insert / group children", () => {
  const rows = [
    { id: "direct1", name: "A" },
    { insert: [{ id: "in1", name: "B" }, { id: "grp", name: "G", group: true, config: [{ id: "child", name: "C" }] }] },
  ]
  const byId = Object.fromEntries(listEntries(rows).map((e) => [e.entry.id, e]))
  assert.equal(byId.direct1.source, "direct")
  assert.equal(byId.in1.source, "insert")
  assert.equal(byId.child.source, "group")
  assert.equal(byId.child.groupId, "grp")
})

test("validateRows rejects bad id / dup / unknown field / dynamic expressions", () => {
  assert.match(validateRows([{ id: "Bad_Id", name: "x" }]), /id/)
  assert.match(validateRows([{ id: "a", name: "x" }, { insert: [{ id: "a", name: "y" }] }]), /duplicate/)
  assert.match(validateRows([{ id: "a", name: "x", rogue: 1 }]), /unknown field/)
  assert.match(validateRows([{ id: "a", name: "x", config: { t: "process.env.TOKEN" } }]), /dynamic/)
})

test("containsJsTags detects process.env indirection", () => {
  assert.equal(containsJsTags([{ id: "a", name: "ok" }]), false)
  assert.equal(containsJsTags([{ id: "a", name: "x", config: { token: "process.env.GITHUB_TOKEN" } }]), true)
})

test("addRow appends an independent insert block and enforces shape", () => {
  assert.deepEqual(addRow([], { id: "hello", name: "p" }), [{ insert: [{ id: "hello", name: "p" }] }])
  assert.throws(() => addRow([], { id: "UPPER", name: "p" }), /id/)
  assert.throws(() => addRow([], { id: "ok", name: "" }), /name/)
})

test("updateRow merges in place; id immutable; unknown id throws", () => {
  const rows = [{ insert: [{ id: "a", name: "old", config: { k: 1 } }] }]
  updateRow(rows, "a", { name: "new" })
  assert.equal(rows[0].insert[0].name, "new")
  assert.equal(rows[0].insert[0].config.k, 1)
  assert.throws(() => updateRow(rows, "a", { id: "b" }), /immutable/)
  assert.throws(() => updateRow(rows, "ghost", { name: "n" }), /no entry/)
})

test("removeRow splices from the real container", () => {
  const rows = [
    { id: "keep", name: "K" },
    { insert: [{ id: "bye", name: "B" }] },
  ]
  removeRow(rows, "bye")
  assert.equal(rows.length, 1)
  assert.equal(listEntries(rows).length, 1)
  assert.throws(() => removeRow(rows, "ghost"), /no entry/)
})

test("toggleRow flips disabled on plugin rows; refuses groups", () => {
  const rows = [{ insert: [{ id: "a", name: "A" }, { id: "g", name: "G", group: true, config: [] }] }]
  toggleRow(rows, "a", true)
  assert.equal(rows[0].insert[0].disabled, true)
  toggleRow(rows, "a", false)
  assert.equal(rows[0].insert[0].disabled, false)
  assert.throws(() => toggleRow(rows, "g", true), /group/)
})

test("replaceRows validates wholesale", () => {
  assert.throws(() => replaceRows([], [{ id: "bad id", name: "x" }]), /id/)
  assert.equal(replaceRows([], [{ id: "a", name: "x" }]).length, 1)
})

test("serialize→parse round-trip preserves insert/group structure", async (t) => {
  await withTempDir(t, async (dir) => {
    const file = `${dir}/cordis.patch.yml`
    const fs = await import("node:fs/promises")
    await writeFile(file, serializeRows([{ id: "pre", name: "P" }])) // 基线含 pre，确保 .bak 有内容
    let rows = (await readPatchDoc(file, 1 << 20)).rows
    rows = addRow(rows, { id: "demo", name: "demo-plugin", config: { port: 1 } })
    await writePatchAtomic(file, serializeRows(rows))
    const reread = await readPatchDoc(file, 1 << 20)
    const ids = listEntries(reread.rows).map((e) => e.entry.id).sort()
    assert.deepEqual(ids, ["demo", "pre"])
    assert.equal(reread.rows.find((r) => r.insert)?.insert[0].config.port, 1)
    const bak = await fs.readFile(`${file}.bak`, "utf8")
    assert.ok(bak.includes("pre"))
  })
})
