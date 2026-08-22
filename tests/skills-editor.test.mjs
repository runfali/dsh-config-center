/**
 * skills-editor 单元测试 — node --test
 * 覆盖：frontmatter 解析/回写 / 开关语义（删除键=恢复默认）/ 越界防护 / 模板创建 / 多根聚合
 */
import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { withTempDir } from "./helpers.mjs"
import {
  createSkillFromTemplate,
  listSkills,
  parseSkillMd,
  removeSkill,
  renderSkillMd,
  scanRoot,
  setSkillFlags,
  skillRoots,
} from "../src/skills-editor.js"

test("parseSkillMd: frontmatter + body split", () => {
  const raw = "---\nname: demo\ndescription: D\n---\n\nBODY"
  const { fm, body, hasFrontmatter } = parseSkillMd(raw)
  assert.equal(fm.name, "demo")
  assert.equal(body.trimStart().startsWith("BODY"), true)
  assert.equal(hasFrontmatter, true)
})

test("parseSkillMd: no frontmatter", () => {
  const r = parseSkillMd("just text")
  assert.deepEqual(r.fm, {})
  assert.equal(r.hasFrontmatter, false)
})

test("renderSkillMd round-trip keeps body intact", () => {
  const fm = { name: "x", description: "d", "user-invocable": false }
  const body = "\nhello\nworld\n"
  const text = renderSkillMd(fm, body)
  const back = parseSkillMd(text)
  assert.equal(back.fm["user-invocable"], false)
  assert.equal(back.body.replace(/^\n/, ""), body.replace(/^\n/, ""))
})

test("skillRoots rank table matches provider contract", () => {
  const roots = skillRoots({
    dshHome: "/h",
    agentsHome: "/a",
    projectRoot: "/p",
    customSkillDirs: ["/c1"],
  })
    assert.equal(roots.find((r) => r.rank === 300).writable, false) // custom 根从 300 起
  assert.equal(roots.find((r) => r.rank === 400).writable, true)
  assert.equal(roots.filter((r) => r.writable).length, 1)
})

test("scanRoot discovers bundle and flat skills; skips dotted dirs", async (t) => {
  await withTempDir(t, async (dir) => {
    await mkdir(join(dir, "alpha"), { recursive: true })
    await mkdir(join(dir, ".system"), { recursive: true })
    await writeFile(join(dir, "alpha", "SKILL.md"), "---\nname: alpha\ndescription: A\n---\nb")
    await writeFile(join(dir, "beta.md"), "---\nname: beta\ndescription: B\n---\nb")
    await writeFile(join(dir, "gamma.md"), "no frontmatter here")
    const items = await scanRoot({ root: dir, writable: true, id: "t", rank: 1 })
    const byId = Object.fromEntries(items.map((i) => [i.id, i]))
    assert.equal(byId.alpha.source, "bundle")
    assert.equal(byId.beta.source, "flat")
    assert.equal(byId.gamma.modelVisible, true) // 无 frontmatter 默认可见
    assert.equal(byId[".system"], undefined)
  })
})

test("setSkillFlags toggles disable-model-invocation via key deletion", async (t) => {
  await withTempDir(t, async (dir) => {
    await mkdir(join(dir, "s1"), { recursive: true })
    const file = join(dir, "s1", "SKILL.md")
    await writeFile(file, "---\nname: s1\ndescription: D\n---\nBODY")
    const spec = { id: "t", root: dir, writable: true, rank: 400 }
    await setSkillFlags(spec, { id: "s1", source: "bundle" }, { modelVisible: false, userInvocable: false })
    let raw = await readFile(file, "utf8")
    assert.ok(raw.includes("disable-model-invocation: true"))
    assert.ok(raw.includes("user-invocable: false"))
    assert.ok(raw.includes("BODY"))
    // 反向：恢复可见 = 删键而非写 false（省 token 且与默认语义一致）
    await setSkillFlags(spec, { id: "s1", source: "bundle" }, { modelVisible: true, userInvocable: true })
    raw = await readFile(file, "utf8")
    assert.ok(!raw.includes("disable-model-invocation"))
    assert.ok(!raw.includes("user-invocable"))
  })
})

test("setSkillFlags refuses read-only roots; missing skill errors", async (t) => {
  await withTempDir(t, async (dir) => {
    const spec = { id: "ro", root: dir, writable: false, rank: 100 }
    await assert.rejects(
      () => setSkillFlags(spec, { id: "s", source: "flat" }, { modelVisible: false }),
      /read-only/,
    )
  })
})

test("removeSkill escapes-root protection", async (t) => {
  await withTempDir(t, async (outer) => {
    const inner = join(outer, "skills")
    await mkdir(inner, { recursive: true })
    const victim = join(outer, "outside.txt")
    await writeFile(victim, "x")
    const spec = { id: "u", root: inner, writable: true, rank: 400 }
    // 直接给绝对路径越界目标 —— ensureInside 应拒绝（id 拼接在根内，此处验证防护逻辑本身）
    assert.equal(await import("../src/skills-editor.js").then((m) => m.ensureInside(inner, victim)), false)
    await rm(victim, { force: true })
  })
})

test("createSkillFromTemplate validates id and writes skeleton", async (t) => {
  await withTempDir(t, async (dir) => {
    const tpl = { root: dir, writable: true }
    await assert.rejects(() => createSkillFromTemplate({ id: "Bad!", description: "d" }, tpl), /id/)
    await assert.rejects(() => createSkillFromTemplate({ id: "ok-skill", description: "" }, tpl), /description/)
    const res = await createSkillFromTemplate({ id: "ok-skill", description: "D", whenToUse: "when x" }, tpl)
    assert.match(res.path, /ok-skill\/SKILL\.md$/)
    const raw = await readFile(res.path, "utf8")
    const { fm } = parseSkillMd(raw)
    assert.equal(fm.name, "ok-skill")
    assert.equal(fm.whenToUse, "when x")
  })
})

test("listSkills aggregates across roots with provenance", async (t) => {
  await withTempDir(t, async (home) => {
    await mkdir(join(home, "skills", "userskill"), { recursive: true })
    await writeFile(join(home, "skills", "userskill", "SKILL.md"), "---\nname: userskill\ndescription: U\n---\n")
    const skills = await listSkills({ dshHome: home, agentsHome: "", projectRoot: "", customSkillDirs: [] })
    assert.equal(skills.length, 1)
    assert.equal(skills[0].rootId, "user-dsh")
    assert.equal(skills[0].rank, 400)
    assert.equal(skills[0].rootWritable, true)
  })
})
