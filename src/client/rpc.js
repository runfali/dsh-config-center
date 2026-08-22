/** 同源 JSON RPC 封装：/api/config-center/<method>（V-RPC 方案 A） */
export async function rpc(method, args) {
  const res = await fetch(`/api/config-center/${method}`, {
    method: args === undefined ? "GET" : "POST",
    headers: args === undefined ? undefined : { "content-type": "application/json" },
    body: args === undefined ? undefined : JSON.stringify(args),
  })
  let body = null
  try {
    body = await res.json()
  } catch {}
  if (!res.ok || !body?.ok) {
    const err = new Error(body?.error ?? `rpc ${method} failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

/** 错误消息提取 */
export function errText(err) {
  return String(err?.message ?? err)
}

/** 简易确认弹窗返回 Promise<boolean>（T10 二次确认统一入口） */
export function confirmDialog(text) {
  // eslint-disable-next-line no-alert
  return Promise.resolve(globalThis.confirm ? globalThis.confirm(text) : true)
}
