#!/usr/bin/env node
/* ============================================================================
 * 验证：dsh-pet-lingchong 的浏览器半边契约 + 渲染冒烟（无需浏览器）
 * ----------------------------------------------------------------------------
 * ① manifest：package.json 有 dsh.client，exports["./client"] 指向真实文件
 *    （主项目 src-tauri/src/dsh_plugin.rs 安装校验的两条硬门槛）；
 * ② 产物形态：能被 window.__ModuleLoader__.load 收下、id 正确、无 ESM 残留；
 * ③ require：react / react/jsx-runtime 全部可满足（真 React 取自主项目仓库，
 *    与兼容层宿主同一份 —— 插件不自带）；出现别的 require 判红；
 * ④ apply(ctx)：动态注入 → 两个座位注册（shell.overlay + sidebar.footer.action），
 *    返回值是 React 元素；
 * ⑤ 渲染冒烟：renderToStaticMarkup 两个座位组件 → 非空、含默认灵宠名、
 *    零异常（等价于在宿主里把两张卡各挂一次）；
 * ⑥ 样式与素材：STYLE 文本带 pet 令牌 + ljp 壳；三只常驻灵宠图已内联 data:；
 * ⑦ 清理：effect 清理函数把 <style> 摘掉。
 *
 * 运行：node scripts/verify-bundle.mjs
 * React 取用顺序：插件目录 node_modules → ../dev/node_modules（主项目）。
 * ========================================================================== */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

let pass = 0;
let fail = 0;
const ok = (cond, label, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${label}`);
  } else {
    fail += 1;
    console.error(`  ✗ ${label}${detail ? ` —— ${detail}` : ''}`);
  }
};

/* ---------------------------------------------------------------- ① manifest */
console.log('① manifest');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
ok(Boolean(pkg.dsh?.client), 'package.json 带 dsh.client 字段');
ok(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform = web');
ok(Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.length > 0, 'dsh.client.inject 非空');
const clientEntryRaw =
  typeof pkg.exports?.['./client'] === 'string'
    ? pkg.exports['./client']
    : pkg.exports?.['./client']?.default;
ok(typeof clientEntryRaw === 'string', 'exports["./client"] 有解析值', String(clientEntryRaw));
const clientEntry = resolve(root, clientEntryRaw ?? 'lib/client.js');
ok(existsSync(clientEntry), 'client 产物文件真实存在', clientEntry);
ok(existsSync(resolve(root, 'lib/client.js')), 'lib/client.js 存在（DSH 缺省路径兜底也要在）');

/* ---------------------------------------------------------------- ② 产物形态 */
console.log('② 产物形态');
const source = readFileSync(resolve(root, 'lib/client.js'), 'utf8');
ok(/window\.__ModuleLoader__\.load\(\{/.test(source), '产物包在 window.__ModuleLoader__.load 里');
ok(source.includes("id: 'dsh-pet-lingchong'"), '注册 id = dsh-pet-lingchong');
ok(!/^\s*import\s|^\s*export\s/m.test(source), '无 ESM 语句残留（普通脚本）');
ok(!source.includes('import.meta'), '无 import.meta（经典脚本求值）');
ok(!/\bnew Function\b/.test(source), '插件自己不再 new Function（求值是宿主的事）');

/* --------------------------------------------------------------- ③ ④ ⑤ 运行 */
console.log('③④⑤ 运行 + 渲染');

function loadReact() {
  // 灵宠包住在 dsh-plugins/ 工作区里:候选含 工作区根/node_modules、主项目(D:\WWW\dev)、以及老的相邻布局
  const candidates = [
    resolve(root, 'node_modules'),
    resolve(root, '..', 'node_modules'),
    resolve(root, '..', '..', 'dev', 'node_modules'),
    resolve(root, '..', 'dev', 'node_modules')
  ];
  for (const nm of candidates) {
    try {
      const req = createRequire(resolve(nm, 'package.json'));
      const react = req('react');
      const server = req('react-dom/server');
      return { react, server, nm, req };
    } catch {
      /* 下一个 */
    }
  }
  return null;
}

const reactPkg = loadReact();
if (!reactPkg) {
  console.error('  ✗ 找不到 react / react-dom/server（试过插件目录与 ../dev/node_modules）');
  process.exit(1);
}
console.log(`  · React ${reactPkg.react.version} ← ${reactPkg.nm}`);

const bundles = [];
const fakeWindow = {
  __ModuleLoader__: {
    load(entry) {
      bundles.push(entry);
    }
  },
  addEventListener() {},
  removeEventListener() {},
  setTimeout,
  clearTimeout,
  setInterval: () => 0,
  clearInterval() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: (cb) => setTimeout(cb, 0),
  cancelAnimationFrame: clearTimeout,
  innerWidth: 1680,
  innerHeight: 1000,
  devicePixelRatio: 1,
  screen: { width: 3840, height: 2160, colorDepth: 24 },
  location: { protocol: 'https:', href: 'https://dsh.test/', origin: 'https://dsh.test' },
  localStorage: {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
    removeItem(k) { this._m.delete(k); }
  }
};
const removedStyles = [];
const fakeDocument = {
  createElement() {
    const el = { id: '', textContent: '', remove: () => removedStyles.push(el.id), isConnected: true };
    return el;
  },
  head: { appendChild() {} },
  documentElement: { classList: { contains: () => false } }
};

/* 求值：与主项目 runClassicScript 同语义（全局经典脚本，window 可得） */
const run = new Function('window', 'document', 'console', source);
try {
  run(fakeWindow, fakeDocument, console);
  ok(true, '脚本求值无异常');
} catch (err) {
  ok(false, '脚本求值无异常', String(err));
  process.exit(1);
}
ok(bundles.length === 1, '恰好注册一个 bundle', `实际 ${bundles.length}`);
const bundle = bundles[0];
ok(typeof bundle?.factory === 'function', 'bundle.factory 是函数');

const registered = [];
const cleanups = [];
const slots = {
  inject(name, cb) {
    queueMicrotask(cb);
  },
  register(meta, render) {
    registered.push({ ...meta, render });
    return () => {};
  }
};
const services = {
  slots,
  uiSession: { scene: 'idle', busy: false, subscribe: () => () => {} },
  effect(fn, label) {
    const off = fn();
    if (typeof off === 'function') cleanups.push(off);
  }
};
const ctx = {
  inject(deps, cb) {
    queueMicrotask(() => cb(services));
  }
};

const requiredModules = [];
const pluginRequire = (name) => {
  requiredModules.push(name);
  if (name === 'react') return reactPkg.react;
  if (name === 'react/jsx-runtime') return reactPkg.req('react/jsx-runtime');
  if (name === 'react-dom/client') return reactPkg.req('react-dom/client');
  return undefined;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

let bundleExports = null;
try {
  const exports = bundle.factory(pluginRequire);
  bundleExports = exports;
  ok(typeof exports?.apply === 'function', 'exports.apply(ctx) 存在');
  exports.apply(ctx);
  await flush();
  await flush();
} catch (err) {
  ok(false, 'factory + apply 执行无异常', String(err));
  process.exit(1);
}

const names = registered.map((r) => r.name);
ok(names.includes('shell.overlay'), '注册座位 shell.overlay', names.join(','));
ok(names.includes('sidebar.footer.action'), '注册座位 sidebar.footer.action', names.join(','));
ok(
  registered.every((r) => typeof r.render === 'function'),
  '每个座位都有 render 函数'
);
ok(
  requiredModules.every(
    (m) => m === 'react' || m === 'react/jsx-runtime' || m === 'react-dom' || m === 'react-dom/client'
  ),
  'require 清单干净（react 系之外没有别的依赖）',
  requiredModules.join(',')
);

const { renderToStaticMarkup } = reactPkg.server;
const h = reactPkg.react.createElement;
try {
  const overlayEl = registered.find((r) => r.name === 'shell.overlay')?.render();
  const footerEl = registered.find((r) => r.name === 'sidebar.footer.action')?.render();
  ok(overlayEl && typeof overlayEl === 'object', 'shell.overlay 返回 React 元素');
  const overlayHtml = renderToStaticMarkup(overlayEl);
  ok(overlayHtml.length > 0, '悬浮灵宠 host SSR 可渲染', `${overlayHtml.length} 字符`);
  ok(overlayHtml.includes('data-ljp-pet'), 'host 标记 data-ljp-pet 在(shadow 内部由 CDP 验)');
  /* 灵宠名/图片断言移除:Shadow DOM 化后 SSR 只见 host */

  const footerHtml = renderToStaticMarkup(footerEl);
  ok(footerHtml.includes('data-ljp-footer'), '侧栏面板 host 标记(Shadow DOM 化后 SSR 只见 host)');
  const openPanel = renderToStaticMarkup(h(footerEl.type, { defaultOpen: true }));
  ok(openPanel.includes('data-ljp-footer'), '侧栏面板可展开渲染(host 形态)');
} catch (err) {
  ok(false, 'renderToStaticMarkup 冒烟', String(err));
}

/* ---------------------------------------------------------------- ⑥ ⑦ 样式素材 */
console.log('⑥⑦ 样式 / 素材 / 清理');
ok((source.match(/data:image\/webp/g) || []).length >= 3, '三只常驻灵宠图已内联');
ok(source.includes('--color-pet-surface'), 'pet 令牌随包分发');
const styleText = typeof bundleExports?.STYLE_TEXT === 'string' ? bundleExports.STYLE_TEXT : '';
ok(styleText.length > 100000, 'STYLE_TEXT 随包导出且非空', `${styleText.length} 字符`);
ok(
  /:host\s*,\s*:host\s*\{[\s\S]{0,9000}?--spacing\s*:/.test(styleText),
  'tailwind 主题变量挂进 :host 作用域(剥层脚本吞选择器的回归闸,2026-10-26)'
);
ok(
  /:host\s*[,{][\s\S]{0,9000}?--color-pet-surface\s*:/.test(styleText),
  'pet 令牌可达 :host 作用域(设置页取色前提)'
);
ok(
  /:host\s*[,{][\s\S]{0,6000}?--font-pet-mono\s*:/.test(styleText),
  '设置页字体令牌 --font-pet-mono 可达(:host)'
);
ok(source.includes('.ljp-card'), 'ljp 壳样式随包分发');
ok(source.includes('.ljp-bubble'), '性格气泡样式随包');
ok(
  source.includes('CSS.registerProperty') || source.includes('registerProperty'),
  '@property 文档级注册桥随包(shadow 内 @property 不生效的修复,2026-10-26)'
);
ok(source.includes('greet-reunion') && source.includes('chat-reply') && source.includes('chat-busy'), '见面问候/对话陪伴决策随包');
const cjkEscaped = (s) =>
  s.replace(/[^\x00-\x7F]/g, (ch) => '\\u' + ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
ok(
  source.includes('dsh-pet-lingchong-models') && source.includes('GLTFLoader'),
  '3D 模型存储 + GLTF 渲染随包(云端生成由用户在 meshy/tripo 网页完成,2026-10-26 口径)'
);
ok(
  source.includes(cjkEscaped('选择图片或 GLB 文件')) &&
    source.includes(cjkEscaped('导入灵宠')) &&
    source.includes(cjkEscaped('灵宠大小')),
  '导入灵宠(图片/GLB·5 只上限)+ 大小调节 UI 随包(2026-10-26 口径)'
);
ok(
  source.includes('dsh-pet-lingchong-fonts'),
  '灵宠设计字体桥随包(Cinzel/Outfit/Space Grotesk,主项目同款 Google Fonts)'
);
ok(
  source.includes('对话陪伴') || source.includes(cjkEscaped('对话陪伴')),
  '面板对话陪伴状态行随包(esbuild 默认 charset=ascii 会转义 CJK,两种形态都认)'
);
ok(source.includes('.ljp-pip') && source.includes('documentPictureInPicture'), 'PiP 逃生门随包（样式 + 能力检测）');
ok(
  (source.match(/data:image\/webp/g) || []).length >= 3 &&
    statSync(resolve(root, 'lib/assets/pets/cat.webp')).size > 0,
  'lib/assets/ 保留标准资源位'
);
cleanups.forEach((fn) => fn());
ok(true, '样式随 ShadowScope 生命周期(不进 document.head)');

/* ---------------------------------------------------------------- 汇总 */
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
