// Generates favicon set from assets/img/logo.png at sizes Google + browsers expect:
//   - assets/img/favicon-16.png  (Google search result tiny icon)
//   - assets/img/favicon-32.png  (browser tab)
//   - assets/img/favicon-180.png (Apple touch icon, iOS bookmarks)
//   - assets/img/favicon-512.png (Android home screen, PWA)
//
// Crops the PF mark (top portion) so the small "PAPARAZZI FASHION" text isn't
// rendered illegibly at 16×16 — at small sizes only the PF monogram is visible.
//
// Run: node tools/generate_favicons.js
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const LOGO_SRC = path.join(ROOT, 'assets', 'img', 'logo.png');
const OUT_DIR = path.join(ROOT, 'assets', 'img');

const SIZES = [16, 32, 180, 512];

function fileToFileUrl(p) { return 'file:///' + p.replace(/\\/g, '/'); }

function buildHtml(size) {
  const logoUrl = fileToFileUrl(LOGO_SRC);
  // The original logo (612×612) has the PF mark in the top ~65% and the
  // "PAPARAZZI FASHION" footer in the bottom ~25%. We zoom + offset so
  // only the PF monogram is visible; the text would be illegible at small
  // favicon sizes anyway.
  // Background-size = 165% means the source image is 1.65× bigger than the
  // icon, so the lower text portion overflows below and is clipped.
  // Background-position vertical 22% centres the PF mark inside the icon.
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: ${size}px; height: ${size}px; overflow: hidden;
    background: #ffffff;
  }
  .wrap {
    width: 100%; height: 100%;
    background-image: url('${logoUrl}');
    background-repeat: no-repeat;
    background-position: center 22%;
    background-size: 165% auto;
  }
</style></head>
<body><div class="wrap"></div></body></html>`;
}

(async () => {
  if (!fs.existsSync(LOGO_SRC)) {
    console.error('Missing logo:', LOGO_SRC); process.exit(1);
  }
  const browser = await chromium.launch();
  const tmp = path.join(__dirname, '_favicon_render.html');
  for (const size of SIZES) {
    fs.writeFileSync(tmp, buildHtml(size), 'utf-8');
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.goto(fileToFileUrl(tmp), { waitUntil: 'load' });
    await page.waitForTimeout(200);
    const out = path.join(OUT_DIR, `favicon-${size}.png`);
    await page.screenshot({ path: out, type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
    await page.close();
    const stat = fs.statSync(out);
    console.log(`favicon-${size}.png  (${stat.size} bytes)`);
  }
  fs.unlinkSync(tmp);
  await browser.close();
  console.log('=== favicons done ===');
})().catch(e => { console.error(e); process.exit(1); });
