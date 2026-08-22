/** 测试助手：临时目录生命周期 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** 在 t 作用域内创建临时目录，结束后递归删除 */
export async function withTempDir(t, fn) {
  const dir = await mkdtemp(join(tmpdir(), "cc-test-"))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return fn(dir)
}
