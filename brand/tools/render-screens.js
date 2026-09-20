// render-screens.js — screenshots every mockup under 04-ux/screens/ to 04-ux/screens/png/. Needs playwright.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const dir = path.join(root, '04-ux/screens'), out = path.join(dir, 'png');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let bad = 0;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.html')).sort()) {
    const width = f.startsWith('www') ? 1280 : 390;
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('file://' + path.join(dir, f), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.style).filter((v, i, a) => a.indexOf(v) === i));
    await page.screenshot({ path: path.join(out, f.replace('.html', '.png')), fullPage: true });
    console.log(f.padEnd(30), errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok', '| fonts:', fonts.join(', '));
    if (errs.length) bad++;
    await page.close();
  }
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
