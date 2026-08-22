/** 扩展中心样式（对齐官方 settings 视觉变量）——由 client.tsx 调 injectCss() 注入 */
export function injectCss() {
  if (typeof document === "undefined") return
  const TAG_ID = "dsh-config-center/css"
  if (document.querySelector(`style[data-plugin-css="${TAG_ID}"]`)) return
  const tag = document.createElement("style")
  tag.dataset.plugin = "dsh-config-center"
  tag.dataset.pluginCss = TAG_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

export const CSS = `
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
.cc-btn{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5;border:1px solid transparent}
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
.cc-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;width:100%;box-sizing:border-box}
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
`
