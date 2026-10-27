/** 日期键（YYYY-MM-DD）—— 从主项目 `src/utils/format.ts#dateKey` 原样复制。
 *  全仓（含插件）日期键只有这一个实现，跨天归零都靠它。 */
const pad2 = (n: number): string => String(n).padStart(2, '0');

export const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
