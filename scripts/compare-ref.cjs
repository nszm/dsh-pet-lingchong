const path = require('path');
const fs = require('fs');
const PW = 'C:/Users/ZHUIN/.workbuddy/binaries/node/workspace/node_modules/playwright-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = process.env.LJ_VERIFY_PORT || 3143;
const OUT = 'D:/WWW/dsh-plugins/dsh-pet-lingchong/verify-output';
const SLUG = 'dsh-pet-lingchong';
const ROOT = 'D:/WWW/dsh-plugins/dsh-pet-lingchong';

const dshInvoke = (cmd, args) => {
  const a = args || {};
  if (cmd === 'dsh_plugin_scan') return [{ id: SLUG, slug: SLUG, name: SLUG, version: '1.0.0', description: '', dir: ROOT, clientEntry: path.join(ROOT, 'lib', 'client.js'), assetsDir: path.join(ROOT, 'lib', 'assets'), meta: { client: { platform: 'web' } }, installedAt: Date.now() }];
  if (cmd === 'dsh_plugin_read') { const abs = path.isAbsolute(a.path) ? a.path : path.join(ROOT, a.path); return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null; }
  if (cmd === 'dsh_plugin_asset') { const abs = path.isAbsolute(a.path) ? a.path : path.join(ROOT, a.path); return fs.existsSync(abs) ? 'data:image/webp;base64,' + fs.readFileSync(abs).toString('base64') : null; }
  if (cmd === 'dsh_plugin_root') return ROOT;
  return null;
};

(async () => {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1040 }, deviceScaleFactor: 1 });
  await page.exposeFunction('__ljDshInvoke', (cmd, args) => dshInvoke(cmd, args));
  await page.addInitScript(({ slug }) => {
    const stub = {
      invoke: (cmd, args) => (typeof cmd === 'string' && cmd.startsWith('dsh_plugin_')) ? window.__ljDshInvoke(cmd, args) : Promise.resolve(null),
      transformCallback: (cb) => { const id = Math.floor(Math.random() * 1e9); window[`_${id}`] = cb; return id; },
      convertFileSrc: (p) => p,
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } }
    };
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: stub, configurable: true });
    if (!sessionStorage.getItem('__lj_seeded')) {
      sessionStorage.setItem('__lj_seeded', '1');
      localStorage.setItem('lijing.dsh.plugins.v1', JSON.stringify({ [slug]: true }));
    }
  }, { slug: SLUG });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  /* ---- A. 主项目原版灵宠页(参考) ---- */
  const navItem = page.getByText('灵宠', { exact: true }).first();
  await navItem.waitFor({ state: 'visible', timeout: 15000 });
  await navItem.click();
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'ref-lijing-pet.png') });
  console.log('A reference screenshot saved');

  /* ---- B. 插件灵宠(浮层) ---- */
  const footBtn = page.locator('[data-ljp-footer] .ljp-footer-btn');
  await footBtn.waitFor({ state: 'visible', timeout: 8000 });
  if (!(await page.locator('[data-ljp-footer] .ljp-panel').isVisible().catch(() => false))) {
    await footBtn.click({ force: true, timeout: 5000 });
  }
  const panel = page.locator('[data-ljp-footer] .ljp-panel');
  await panel.waitFor({ state: 'visible', timeout: 5000 });
  await panel.locator('button[title*="灵宠"]').click();
  await page.locator('[data-ljp-studio] .ljpful-petstudio').waitFor({ state: 'visible', timeout: 8000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, 'plugin-studio.png') });
  console.log('B plugin screenshot saved');
  await browser.close();
})().catch(e => { console.error('ERR', String(e).slice(0, 300)); process.exit(1); });
