// 运行时由 dsh profile 注入的模块（不在本插件 node_modules 中），仅作类型占位。
// package.json 的 dsh.client.inject 声明了加载顺序；此处只为 tsc 提供模块解析。
declare module "@deepseek-ai/dsh-client-locale/client" {}