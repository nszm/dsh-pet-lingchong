/**
 * dsh-pet-lingchong — host half（骨架）。
 *
 * 卡片的全部界面与数据都在浏览器半边（lib/client.js，经 `dsh.client` 由
 * DSH web 壳注入页面）。宿主半边只需要**存在**：cordis loader 装载的是这里
 * （package.json `main` / exports["."] → 本文件），没有它，包只是 node_modules
 * 里的一个惰性依赖 —— 装了、启用开关亮着，但 web 壳永远不知道要把
 * client.js 注入页面（2026-10-25 的「开了无效」就是这个形状）。
 *
 * 不碰任何宿主服务（webServer / 路由 / 状态文件都不需要）：卡片数据走页面
 * localStorage（与主项目同键）。参考 dsh-pet-indesktop 的约定：静态 inject 只在
 * 宿主半边合适，而本骨架连 webServer 都不用，所以零依赖、零路由、零状态。
 */
export const name = 'dsh-pet-lingchong'
export const version = '1.1.3'
export const routes = []

/** 空实现：装载即活跃。浏览器半边的一切由 web 壳按 `dsh.client` 接管。 */
export function apply(_ctx) {
  // 有意什么都不做。将来要宿主能力（如路由/持久化）再在这里加。
}
