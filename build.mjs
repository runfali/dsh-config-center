import { build } from "esbuild"
import { readFileSync } from "node:fs"

// browser bundle -> lib/client.js（CJS factory envelope，同官方 / dsh-paperclip）
const clientBuild = await build({
  entryPoints: ["src/client.tsx"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  outfile: "lib/client.js",
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@deepseek-ai/dsh-client-locale",
    "@deepseek-ai/dsh-client-runtime",
    "@deepseek-ai/dsh-client-connection",
    "@deepseek-ai/dsh-api-remotes",
    "@deepseek-ai/dsh-client-ui-settings",
    "@deepseek-ai/dsh-client-ui-slots",
    "@deepseek-ai/dsh-client-ui-primitives",
    "@deepseek-ai/dsh-client-ui-conversation",
  ],
  banner: {
    js: 'window.__ModuleLoader__.load({id:"dsh-config-center",factory:(require)=>{var module={exports:{}};var exports=module.exports;',
  },
  footer: { js: "return module.exports;}});" },
  charset: "utf8",
  sourcemap: true,
  logLevel: "info",
})
console.log("client build done", clientBuild.errors.length, clientBuild.warnings.length)

// 验证 envelope 与 id 约定
try {
  const txt = readFileSync("lib/client.js", "utf8")
  if (!txt.includes("__ModuleLoader__")) throw new Error("factory envelope missing")
  if (!txt.includes('id:"dsh-config-center"')) throw new Error("module loader id must equal package name")
  if (txt.startsWith("export")) throw new Error("ESM output leaked — must be CJS factory")
  console.log("client.js", txt.length, "bytes ✓")
} catch (e) {
  console.error(e)
  process.exit(1)
}

// host 半是纯 ESM 直载，语法自检
await import("./src/index.js").then((m) => {
  if (typeof m.apply !== "function") throw new Error("host apply missing")
  if (!Array.isArray(m.inject)) throw new Error("host inject missing")
  console.log("host index.js ok — name:", m.name, "inject:", m.inject.join(","))
})
