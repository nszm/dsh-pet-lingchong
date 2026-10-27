#!/usr/bin/env node
/* ============================================================================
 * 令牌同步：主项目 src/pets/pets.css → 本插件 css/pet.css
 * ----------------------------------------------------------------------------
 * 灵宠视觉层在主项目仓库是唯一事实源；主项目改了样式后重跑本脚本：
 *
 *     node scripts/sync-css.mjs            # 默认取 ../dev（主项目仓库根）
 *     node scripts/sync-css.mjs D:\\path\\to\\lijing
 *
 * 唯一转换：`@theme {` → `:root {`（Tailwind 的编译期指令，浏览器不认识；
 * 变量必须落成真 CSS 才能随 <style> 注入生效）。其余逐字保留。
 * ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const hostRoot = resolve(process.argv[2] ?? resolve(root, '..', 'dev'));

const srcPath = resolve(hostRoot, 'src/pets/pets.css');
const css = readFileSync(srcPath, 'utf8');

const count = css.split('@theme {').length - 1;
if (count !== 1) {
  console.error(`[sync-css] 预期 pets.css 里恰好一个 @theme 块，实际 ${count} 个：${srcPath}`);
  process.exit(1);
}

const header = `/* ============================================================================
 * 灵宠令牌 · 由主项目 src/pets/pets.css 自动转换而来（node scripts/sync-css.mjs）
 * ----------------------------------------------------------------------------
 * 唯一差异：\`@theme {\` → \`:root {\`。原文件是 Tailwind v4 的主题声明，
 * 编译期才展开；本插件不跑 Tailwind，必须把变量落成浏览器认识的 :root。
 * 其余内容（暗色覆盖 / 动画 / liquid-glass / reduced-motion）逐字保留。
 * 请勿手改本文件 —— 改主项目的 pets.css，然后重跑本脚本。
 * ========================================================================== */
`;

writeFileSync(resolve(root, 'css/pet.css'), header + css.replace('@theme {', ':root {'), 'utf8');
console.log(`[sync-css] css/pet.css 已从 ${srcPath} 同步（${css.split('\n').length} 行）`);
