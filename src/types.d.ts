/** esbuild 把 .css（text loader）与 .webp/.jpg（dataurl loader）编译成字符串，
 *  这里只负责让 tsc / 编辑器认得这些模块。 */
declare module '*.css' {
  const text: string;
  export default text;
}
declare module '*.webp' {
  const url: string;
  export default url;
}
declare module '*.jpg' {
  const url: string;
  export default url;
}
declare module '*.png' {
  const url: string;
  export default url;
}

/** DSH 契约：bundle 由宿主以 factory(require) 求值，运行时的 require 由宿主注入
 *  （构建期 esbuild 已把 react 系标记为 external，产物里剩的就是它）。
 *  类型上只声明「按名取模块」，具体形状由调用处自行收窄。 */
declare function require(name: string): unknown;
