// Receipts for examples/reef (scenarios S1–S6): screenshots + window.__reef.state() numbers.
// Usage: npm run build:site && PLAYWRIGHT_FROM=<package.json with playwright> node tools/capture.mjs [outDir]
// Serves site-dist over HTTP (module scripts do not load from file://) and drives the page headless.
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(root, process.argv[2] || 'docs/receipts/reef');
const site = path.join(root, 'site-dist');
const { chromium } = createRequire(process.env.PLAYWRIGHT_FROM || path.join(root, 'package.json'))('playwright');
fs.mkdirSync(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith('/')) p = path.join(p, 'index.html');
  if (!p.startsWith(site) || !fs.existsSync(p)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }).end(fs.readFileSync(p));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/beat-ui/reef/`;

const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
// (software raster in headless: DPR 1 keeps it near real frame rates)
const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(url);

const log = [];
const state = () => page.evaluate(() => window.__reef.state());
const shot = async (name, note) => {
  const s = await state();
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  log.push({ shot: name, note, at: new Date().toISOString(), state: s });
  console.log(
    `${name}: section=${s.section} bar=${s.bar} step=${s.step} hunger=${s.hunger} dropK=${s.dropK} float=${JSON.stringify(s.float)}`,
  );
  return s;
};
const until = async (pred, ms = 40000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await state();
    if (pred(s)) return s;
    await page.waitForTimeout(60);
  }
  throw new Error('timed out waiting');
};

await page.waitForTimeout(1500);
await shot('s1-idle', 'S1: first screen before play');
await page.click('#go');
await page.waitForTimeout(900);
log.push({ probe: 'first-bar (0.9 s after click)', state: await state() });
await page.waitForTimeout(1700);
await shot('s2-playing', 'S2: ~2.6 s after "hear it on a demo song"');
log.push({
  probe: 'groove, bar 4 (bait-ball baseline)',
  state: await until((s) => s.section === 'groove' && s.bar === 4 && s.step >= 8),
});
await until((s) => s.section === 'breakdown' && s.bar >= 7);
await shot('s3-breakdown', 'S3: breakdown, bar 7');
log.push({ probe: 'pre-drop', state: await until((s) => s.section === 'breakdown' && s.bar === 8 && s.step >= 9) });
await until((s) => s.section === 'drop');
await page.waitForTimeout(900);
await shot('s4-drop', 'S4: 0.9 s after the drop (bar 9)');
await until((s) => s.hunger < 0.05, 15000);
log.push({ probe: 'pre-D-key', state: await state() });
await page.keyboard.press('d');
await page.waitForTimeout(800);
await shot('s5-dkey', 'S5: 0.8 s after pressing D');
await page.keyboard.press('z');
await page.waitForTimeout(1800);
await shot('s6-codehidden', 'S6: 1.8 s after pressing Z');

// the second consumer: examples/minimal plays, types its code and moves the grid's playhead
const mini = await browser.newPage({ viewport: { width: 640, height: 520 }, deviceScaleFactor: 1 });
const miniErrors = [];
mini.on('pageerror', (e) => miniErrors.push(String(e)));
await mini.goto(url.replace('/reef/', '/minimal/'));
await mini.click('#go');
await mini.waitForTimeout(6500);
const minimal = await mini.evaluate(() => ({
  lines: [...document.querySelectorAll('#code .ln')].map((el) => el.textContent),
  playhead: !!document.querySelector('.wid .ph'),
  footer: document.querySelector('.wid .ft')?.textContent ?? null,
}));
await mini.screenshot({ path: path.join(out, 'minimal.png') });
console.log(`minimal: ${JSON.stringify(minimal)} errors=${miniErrors.length}`);

fs.writeFileSync(
  path.join(out, 'metrics.json'),
  `${JSON.stringify({ url: '/beat-ui/reef/', errors, log, minimal: { ...minimal, errors: miniErrors } }, null, 2)}\n`,
);
console.log(`errors: ${errors.length}`);
await browser.close();
server.close();
