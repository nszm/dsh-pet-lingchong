/* dsh-pet-lingchong · 端到端实测（真浏览器 + 主项目真页面）
 *
 * 借主项目仓库的 scripts/with-server.cjs 起 dev server（本探针自己不碰主项目仓库）：
 *
 *   LJ_VERIFY_PORT=3143 node D:/WWW/dev/scripts/with-server.cjs D:/WWW/dsh-pet-lingchong/scripts/verify-e2e.cjs
 *
 * 与主项目 scripts/probe/verify-dsh-real-plugin.cjs（鲸鱼实测）同一套手法：
 * Playwright 里没有 Tauri ⇒ addInitScript 装 __TAURI_INTERNALS__ 桩，
 * 把 dsh_plugin_* 四条命令转给 Node 侧直接读本插件目录。
 */
const path = require('path');
const fs = require('fs');

const PW = 'C:/Users/ZHUIN/.workbuddy/binaries/node/workspace/node_modules/playwright-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = process.env.LJ_VERIFY_PORT || 3143;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'verify-output');
const SLUG = 'dsh-pet-lingchong';
const PKG = ROOT;

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  · ${detail}` : ''}`);
};

let chromium;
try {
  ({ chromium } = require(PW));
} catch {
  console.error(`[e2e] 找不到 playwright-core（${PW}），跳过浏览器端到端。`);
  console.error('[e2e] 静态契约请跑 node scripts/verify-bundle.mjs');
  process.exit(2);
}

const stateFile = path.join(require('os').tmpdir(), `lj-dsh-lingchong-state-${process.pid}.json`);
const pkgJson = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));

const underPkg = (raw) => {
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(PKG, raw);
  const rel = path.relative(PKG, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return abs;
};

function dshInvoke(cmd, args) {
  const a = args || {};
  if (cmd === 'dsh_plugin_scan') {
    return [
      {
        id: pkgJson.name,
        slug: SLUG,
        name: pkgJson.name,
        version: pkgJson.version,
        description: pkgJson.description.slice(0, 160),
        dir: PKG,
        clientEntry: path.join(PKG, 'lib', 'client.js'),
        assetsDir: path.join(PKG, 'lib', 'assets'),
        meta: pkgJson.dsh,
        installedAt: Date.now()
      }
    ];
  }
  if (cmd === 'dsh_plugin_read') {
    const abs = underPkg(a.path);
    if (!abs || !fs.existsSync(abs)) return null;
    return fs.readFileSync(abs, 'utf8');
  }
  if (cmd === 'dsh_plugin_asset') {
    const abs = underPkg(a.path);
    if (!abs || !fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    return `data:${MIME[ext] || 'application/octet-stream'};base64,${fs.readFileSync(abs).toString('base64')}`;
  }
  if (cmd === 'dsh_plugin_root') return PKG;
  return null;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1040 }, deviceScaleFactor: 1 });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.exposeFunction('__ljDshInvoke', (cmd, args) => dshInvoke(cmd, args));

  await page.addInitScript(
    ({ slug }) => {
      const stub = {
        invoke: (cmd, args) => {
          if (typeof cmd === 'string' && cmd.startsWith('dsh_plugin_')) {
            return window.__ljDshInvoke(cmd, args);
          }
          return Promise.resolve(null);
        },
        transformCallback: (cb) => {
          const id = Math.floor(Math.random() * 1e9);
          window[`_${id}`] = cb;
          return id;
        },
        convertFileSrc: (p) => p,
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } }
      };
      Object.defineProperty(window, '__TAURI_INTERNALS__', { value: stub, configurable: true });
      if (!sessionStorage.getItem('__lj_seeded')) {
        sessionStorage.setItem('__lj_seeded', '1');
        localStorage.setItem('lijing.dsh.plugins.v1', JSON.stringify({ [slug]: true }));
      }
    },
    { slug: SLUG }
  );

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  /* -------------------------------------------------- ① 悬浮灵宠上屏 */

  const card = page.locator('[data-dsh-slot="shell.overlay"] .ljp-card');
  const appeared = await card
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check('① 悬浮灵宠卡出现在 shell.overlay（.ljp-card）', appeared);

  const petImg = page.locator('.ljp-card .ljp-img');
  const imgMeta = await petImg
    .evaluate((el) => ({
      srcPrefix: (el.getAttribute('src') || '').slice(0, 22),
      naturalWidth: el.naturalWidth
    }))
    .catch(() => null);
  check('① 灵宠图为内联 data:image/webp', !!imgMeta && imgMeta.srcPrefix.startsWith('data:image/webp'), imgMeta && imgMeta.srcPrefix);
  check('① 图片真实解码（naturalWidth>0）', !!imgMeta && imgMeta.naturalWidth > 0, imgMeta && String(imgMeta.naturalWidth));

  /* 2026-10-26 Shadow DOM 化:定位/层级内联在 light DOM host([data-ljp-pet]),
     样式表在 host.shadowRoot 里 —— 探针同步改查这两个位置。 */
  const layers = await page.evaluate(() => {
    const host = document.querySelector('[data-ljp-pet]');
    const overlay = document.querySelector('[data-dsh-slot="shell.overlay"]');
    const style = host && host.shadowRoot ? host.shadowRoot.getElementById('dsh-pet-lingchong-style') : null;
    return {
      hostZ: host ? getComputedStyle(host).zIndex : null,
      hostPointer: host ? getComputedStyle(host).pointerEvents : null,
      overlayPointer: overlay ? getComputedStyle(overlay).pointerEvents : null,
      styleInjected: !!style,
      styleHasTokens: !!style && style.textContent.includes('--color-pet-surface'),
      styleHosted: !!style && style.textContent.includes(':host')
    };
  });
  check('① 卡片 host z-index = 2147481000（定位内联化口径）', layers.hostZ === '2147481000', layers.hostZ);
  check('① host 可点（pointer-events:auto），容器穿透', layers.hostPointer === 'auto' && layers.overlayPointer === 'none', `${layers.hostPointer}/${layers.overlayPointer}`);
  check('① 样式注入 shadow root（令牌 + :host 作用域）', layers.styleInjected && layers.styleHasTokens && layers.styleHosted);

  /* 性格系统(2026-10-26,大肥鱼同款骨架):见面问候气泡 */
  const bubble = page.locator('[data-ljp-pet] .ljp-bubble');
  const bubbleShown = await bubble
    .waitFor({ state: 'visible', timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  check('① 见面问候气泡(性格系统)', bubbleShown);
  const bubbleText = bubbleShown ? await bubble.textContent() : '';
  check('① 气泡台词非空', !!bubbleText && bubbleText.trim().length >= 4, (bubbleText || '').slice(0, 26));

  /* -------------------------------------------------- ② 轻叩 → 进度落盘 */

  const tapsBefore = await page.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lijing.pet.progress.v1') || '{}');
      return raw.taps || 0;
    } catch {
      return 0;
    }
  });
  await petImg.click();
  await petImg.click();
  await page.waitForTimeout(300);
  const tapsAfter = await page.evaluate(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('lijing.pet.progress.v1') || '{}');
      return raw.taps || 0;
    } catch {
      return 0;
    }
  });
  check('② 轻叩两次 → lijing.pet.progress.v1 今日 +2', tapsAfter === tapsBefore + 2, `${tapsBefore} → ${tapsAfter}`);

  /* -------------------------------------------------- ③ 卡面零控件（2026-10-26 用户口径）
   * 换宠胶囊已按需求从卡面撤下、收进侧栏面板 —— 换宠落盘改到 ⑤ 面板段验证。 */

  /* -------------------------------------------------- ④ 拖拽 → 摆位落盘 */

  const stage = page.locator('.ljp-card .ljp-stage');
  const box = await stage.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 160, box.y + box.height / 2 - 120, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  const pos = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('dsh-pet-lingchong.pos.v1') || 'null');
    } catch {
      return null;
    }
  });
  check('④ 拖拽 → 摆位写入 dsh-pet-lingchong.pos.v1', !!pos && typeof pos.x === 'number' && pos.x < 70, JSON.stringify(pos));
  const tapsAfterDrag = await page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('lijing.pet.progress.v1') || '{}').taps) || 0;
    } catch {
      return 0;
    }
  });
  check('④ 拖拽结束没有多算一叩（仍是 2）', tapsAfterDrag === tapsAfter, String(tapsAfterDrag));

  /* -------------------------------------------------- ⑤ 侧栏面板：显隐 / 换宠 */

  const footBtn = page.locator('[data-dsh-slot="sidebar.footer.action"] .ljp-footer-btn');
  const footShown = await footBtn.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  check('⑤ 侧栏「🐾 灵宠」按钮出现（sidebar.footer.action）', footShown);
  if (footShown) {
    await footBtn.click();
    const panel = page.locator('.ljp-panel');
    const panelShown = await panel.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    check('⑤ 点按钮 → 面板展开（openPluginPanel 契约可点）', panelShown);
    const pillCount = await panel.locator('.ljp-pill').count();
    check('⑤ 面板换宠胶囊 = 3（卡面零控件,胶囊在面板）', pillCount === 3, String(pillCount));
  const chatDot = await panel.locator('.ljp-chat-dot').count();
  check('⑤ 对话陪伴状态行在面板', chatDot === 1, String(chatDot));
    await panel.locator('.ljp-pill').nth(1).click();
    await page.waitForTimeout(200);
    const currentPet = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('lijing.pet.pet.v1') || 'null');
      } catch {
        return null;
      }
    });
    check('⑤ 点第二颗胶囊 → 当前宠 = dog（金毛）', currentPet === 'dog', String(currentPet));
    const hideSwitch = panel.locator('.ljp-switch').first();
    await hideSwitch.click();
    await page.waitForTimeout(200);
    const cardGone = await page.locator('.ljp-card').count();
    check('⑤ 面板关掉「悬浮灵宠」→ 卡片撤下', cardGone === 0, `count=${cardGone}`);
    const visSaved = await page.evaluate(() => localStorage.getItem('dsh-pet-lingchong.visible.v1'));
    check('⑤ 显隐落盘（visible=false）', visSaved === 'false', String(visSaved));
    await hideSwitch.click();
    const cardBack = await page.locator('.ljp-card').waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    check('⑤ 再打开 → 灵宠回来', cardBack);
  }

  /* ------------------------------------- ⑤.5 灵宠设置页（全屏）还原冒烟 */

  const panel2 = page.locator('.ljp-panel');
  if (!(await panel2.isVisible().catch(() => false))) {
    await page.locator('.ljp-footer-btn').click();
  }
  await panel2.waitFor({ state: 'visible', timeout: 5000 });
  await panel2.locator('button[title*="灵宠"]').click();
  const studio = page.locator('[data-ljp-studio] .ljpful-petstudio');
  const studioShown = await studio
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  check('⑤.5 灵宠全屏页打开（Portal 挂 body）', studioShown);
  if (studioShown) {
    /* 令牌链端到端:shadow 里的 .bg-pet-bg 必须取到 --color-pet-bg 的真实色值 */
    const tok = await page.evaluate(() => {
      const host = document.querySelector('[data-ljp-studio]');
      if (!host || !host.shadowRoot) return null;
      const bg = host.shadowRoot.querySelector('.bg-pet-bg');
      const studioEl = host.shadowRoot.querySelector('.ljpful-petstudio');
      return {
        bg: bg ? getComputedStyle(bg).backgroundColor : null,
        hasAurora: !!host.shadowRoot.querySelector('.pet-aurora'),
        studioRect: studioEl ? { w: studioEl.offsetWidth, h: studioEl.offsetHeight } : null
      };
    });
    /* 2026-10-26 用户口径:亮色皮肤(主项目原版暖白瓷)。只认亮色值。 */
    check(
      '⑤.5 设置页亮色令牌(--color-pet-bg #fcf9f8 → rgb(252,249,248))',
      !!tok && tok.bg === 'rgb(252, 249, 248)',
      tok && JSON.stringify(tok.bg)
    );
    check('⑤.5 主项目原版极光层在(.pet-aurora)', !!tok && tok.hasAurora);
    check('⑤.5 设置页有实际尺寸(非塌陷)', !!tok && tok.studioRect && tok.studioRect.h > 400, tok && JSON.stringify(tok.studioRect));
    fs.mkdirSync(OUT, { recursive: true });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, 'e2e-lingchong-studio.png') });
    console.log(`[e2e] 设置页截图：${path.join(OUT, 'e2e-lingchong-studio.png')}`);
    await page.keyboard.press('Escape');
    const studioGone = await page
      .locator('[data-ljp-studio]')
      .waitFor({ state: 'detached', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    check('⑤.5 Esc 关闭设置页', studioGone);
  }

  /* ------------------------------------- ⑤.6 轻叩台词:每三叩一句 */
  const petBtn = page.locator('.ljp-card .ljp-pet-btn');
  await petBtn.click();
  await petBtn.click();
  await petBtn.click();
  const tapBubble = await page
    .locator('[data-ljp-pet] .ljp-bubble')
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  check('⑤.6 轻叩台词气泡(每三叩一句)', tapBubble);

  /* -------------------------------------------------- ⑥ 零未捕获异常 */

  check('⑥ 零未捕获页面异常', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 200));

  /* -------------------------------------------------- 截图存档 */

  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'e2e-lingchong.png') });
  console.log(`[e2e] 截图：${path.join(OUT, 'e2e-lingchong.png')}`);

  await browser.close();
  try {
    fs.unlinkSync(stateFile);
  } catch {}

  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n[e2e] 结果：${results.length - fail} 通过 / ${fail} 失败`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('[e2e] 探针异常：', err);
  process.exit(1);
});
