#!/usr/bin/env node
/* ============================================================================
 * 构建：src/client.tsx（+ pets 源码 + css）→ lib/client.js
 * ----------------------------------------------------------------------------
 * 产物是**普通脚本**（不是 ESM），包在 DSH 的加载壳里：
 *
 *   window.__ModuleLoader__.load({
 *     id: 'dsh-pet-lingchong',
 *     factory: function (require) { … return module.exports; }
 *   });
 *
 * esbuild 只负责把 TSX 打成 CJS 代码段；壳由本脚本的 banner/footer 拼上。
 * 三条硬规则（与 dsh-pet-indesktop 的产物对齐）：
 *   ① react / react/jsx-runtime / react-dom 一律 external —— 宿主给，
 *      插件不自带（两份 React 会把 hooks 打成两套）；
 *   ② 图片走 dataurl loader 内联 —— 真 DSH 与主项目兼容层都零资源依赖；
 *   ③ CSS 走 text loader 内联，apply 时由插件自己插 <style>。
 *
 * esbuild 优先用本目录 node_modules（npm i 一下就有），否则回落到旁边
 * 主项目仓库（../dev/node_modules）—— 不强制联网安装。
 * ========================================================================== */
import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const ID = 'dsh-pet-lingchong';

function loadEsbuild() {
  try {
    return require('esbuild');
  } catch {
    /* 本地没装，往下找 */
  }
  const candidates = [
    process.env.ESBUILD_PATH,
    resolve(root, '..', 'dev', 'node_modules', 'esbuild'),
    resolve(root, '..', '..', 'dev', 'node_modules', 'esbuild')
  ].filter(Boolean);
  for (const dir of candidates) {
    try {
      return require(dir);
    } catch {
      /* 下一个 */
    }
  }
  console.error(
    '[build] 找不到 esbuild：在插件目录 `npm i -D esbuild`，或设 ESBUILD_PATH 指向某个 node_modules/esbuild'
  );
  process.exit(1);
}

const esbuild = loadEsbuild();

/* 独立构建（不进工作区脚本）时 esbuild 不会读工作区 tsconfig：
 *   · @lj/core 要显式别名到旁边 core 包的源码（ShadowScope 等）；
 *   · lucide-react / react 类型侧的运行包在主项目仓库 node_modules（../../dev）。
 * 两处都给上，`node scripts/build.mjs` 才能单独跑通。 */
const ALIAS = { '@lj/core': resolve(root, '..', 'core', 'src', 'index.ts') };
const NODE_PATHS = [
  resolve(root, '..', '..', 'dev', 'node_modules'),
  resolve(root, '..', 'dev', 'node_modules')
].filter((p) => existsSync(p));

const banner = `window.__ModuleLoader__.load({
  id: '${ID}',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    (function (require, module, exports) {
`;

const footer = `    })(require, module, exports);
    return module.exports;
  }
});
`;

/* ------------------------------------------------ ① Tailwind 按插件裁剪
 * 工作区的 core/css/compiled.css 是 25 个插件的并集（全量 ~158 KB），而本插件只用到
 * 其中一小撮工具类；配套的 host-cards.css（历境卡片层 ~37 KB）本插件一个类都没引用。
 * 这里就地编一份「只扫本插件 src」的版本，再经 esbuild 插件替换掉那条 import：
 * 找不到 tailwind 工具链就原样回落（不强依赖，clone 下来没装 tailwind 也能构）。 */
const WORKSPACE_CSS = resolve(root, '..', 'css', 'cards.css');
const HOST_NM_LIST = [
  resolve(root, '..', '..', 'dev', 'node_modules'),
  resolve(root, '..', 'dev', 'node_modules')
].filter((p) => existsSync(p));

/** 剥掉 @layer 壳：注入宿主页面时层叠层会整体输给 DSH 自己的无层样式（2026-10-26 实测）。
 *  ⚠ 必须认得 `@layer a, b, c;` 这种**列表声明**：早期版本只看紧随的一个字符，
 *  遇到列表就把后面第一条规则的 `{` 当成层体，连选择器一起吞掉（`--var` 裸奔）。 */
function stripLayers(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const j = css.indexOf('@layer', i);
    if (j < 0) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, j);
    // 从 @layer 往后找第一个 ; 或 {，谁先到谁说了算
    const semi = css.indexOf(';', j);
    const brace = css.indexOf('{', j);
    if (semi >= 0 && (brace < 0 || semi < brace)) {
      i = semi + 1; // 声明式（含 `@layer a, b, c;`）——整条丢掉
      continue;
    }
    if (brace < 0) {
      out += css.slice(j);
      break;
    }
    let depth = 1;
    let e = brace + 1;
    while (e < css.length && depth > 0) {
      if (css[e] === '{') depth++;
      else if (css[e] === '}') depth--;
      e++;
    }
    out += css.slice(brace + 1, e - 1);
    i = e;
  }
  return out;
}

async function buildLocalCss() {
  if (!existsSync(WORKSPACE_CSS)) return null;
  let twNode = null;
  let oxide = null;
  for (const nm of HOST_NM_LIST) {
    try {
      twNode = require(resolve(nm, '@tailwindcss', 'node', 'dist', 'index.js'));
      oxide = require(resolve(nm, '@tailwindcss', 'oxide'));
      break;
    } catch {
      /* 下一个 */
    }
  }
  if (!twNode || !oxide) {
    console.warn('[css] 没找到 @tailwindcss/*：回落工作区全量 compiled.css（体积会大 ~90 KB）');
    return null;
  }
  const cssDir = dirname(WORKSPACE_CSS);
  const base = readFileSync(WORKSPACE_CSS, 'utf8');
  const entry =
    base
      // 工作区那份把 25 个插件都 @source 了，这里只留自己
      .replace(/^@source "\.\.\/.*$[\r\n]*/gm, '')
      // 历境卡片层（widget-card / 六档材质…）本插件零引用
      .replace(/^@import "\.\/host-cards\.css";[\r\n]*/m, '') +
    '\n@source "../dsh-pet-lingchong/src";\n';

  const compiler = await twNode.compile(entry, {
    base: cssDir,
    shouldRewriteUrls: true,
    onDependency: () => {},
    customCssResolver: async (spec) => {
      if (spec.startsWith('tailwindcss/')) {
        for (const nm of HOST_NM_LIST) {
          const p = resolve(nm, spec);
          if (existsSync(p)) return p;
        }
      }
      return null;
    }
  });
  const sources = (compiler.root === 'none' ? [] : compiler.root === null ? [{ base: cssDir, pattern: '**/*', negated: false }] : [{ ...compiler.root, negated: false }]).concat(compiler.sources);
  const candidates = [...new oxide.Scanner({ sources }).scan()];
  const out = stripLayers(compiler.build(candidates));
  const oldSize = existsSync(resolve(root, '..', 'core', 'css', 'compiled.css'))
    ? statSync(resolve(root, '..', 'core', 'css', 'compiled.css')).size
    : 0;
  console.log(
    `[css] 按插件裁剪 → ${(out.length / 1024).toFixed(1)} KB（工作区全量 ${(oldSize / 1024).toFixed(1)} KB，candidates ${candidates.length}）`
  );
  return out;
}

const localCss = await buildLocalCss();
const cssPlugins = localCss
  ? [
      {
        name: 'pet-local-css',
        setup(b) {
          // 两处会引到全量 CSS：本插件的 style.ts（../../core/css/compiled.css）
          // 和 @lj/core 的 css.ts（../css/compiled.css）—— 两条都要截住，否则
          // 全量那份会从另一条路又进包（多 90 KB）。
          b.onResolve({ filter: /[/\\]css[/\\]compiled\.css$/ }, () => ({
            path: 'compiled.css',
            namespace: 'pet-local-css'
          }));
          b.onLoad({ filter: /.*/, namespace: 'pet-local-css' }, () => ({
            contents: localCss,
            loader: 'text'
          }));
        }
      }
    ]
  : [];

const result = await esbuild.build({
  entryPoints: [resolve(root, 'src/client.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'],
  alias: ALIAS,
  nodePaths: NODE_PATHS,
  plugins: cssPlugins,
  jsx: 'automatic',
  loader: {
    '.webp': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.png': 'dataurl',
    '.gif': 'dataurl',
    '.svg': 'dataurl',
    '.css': 'text'
  },
  minify: true,
  legalComments: 'none',
  banner: { js: banner },
  footer: { js: footer },
  outfile: resolve(root, 'lib/client.js'),
  logLevel: 'info'
});

/* lib/assets/ 保留一份原始素材：主项目的资源桥会先试 <slug>/lib/<路径>，
 * 这是 DSH 插件的标准资源位（虽然本插件已把图片内联，留着不亏）。 */
mkdirSync(resolve(root, 'lib/assets'), { recursive: true });
cpSync(resolve(root, 'src/assets'), resolve(root, 'lib/assets'), { recursive: true });

const size = (p) => `${(statSync(p).size / 1024).toFixed(1)} KB`;
console.log(`[build] lib/client.js → ${size(resolve(root, 'lib/client.js'))}（warnings: ${result.warnings.length}）`);
if (result.warnings.length) console.log(result.warnings.map((w) => String(w)).join('\n'));
if (!existsSync(resolve(root, 'lib/client.js'))) {
  console.error('[build] 产物缺失');
  process.exit(1);
}
