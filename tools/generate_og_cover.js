// Generates a 1200x630 Open Graph cover image at assets/img/og-cover.jpg
// Uses Playwright to render an HTML collage of 4 random product photos +
// brand mark + tagline, then screenshots it as JPEG.
//
// Run: node tools/generate_og_cover.js
//
// Requires the dev server to be NOT required — we render from inline HTML
// using file:// URLs for the product images.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_JSON = path.join(ROOT, 'assets', 'products.json');
const LOGO_PATH = path.join(ROOT, 'assets', 'img', 'logo.png');
const OUT_PATH = path.join(ROOT, 'assets', 'img', 'og-cover.jpg');

function fileToFileUrl(p) {
  return 'file:///' + p.replace(/\\/g, '/');
}

function pickFour(products) {
  // Want one photo from each of 4 different categories if possible,
  // first-pose only (photo === 1), so we get clean front shots.
  const front = products.filter(p => (p.photo || 1) === 1);
  const byCat = {};
  for (const p of front) {
    (byCat[p.category] = byCat[p.category] || []).push(p);
  }
  const cats = Object.keys(byCat);
  // Prioritize visually distinct categories
  const preferred = ['dress', 'set', 'shirt', 'jacket', 'tunic', 'cardigan', 'tshirt'];
  const ordered = [...preferred.filter(c => cats.includes(c)), ...cats.filter(c => !preferred.includes(c))];
  const picks = [];
  for (const c of ordered) {
    if (picks.length >= 4) break;
    const pool = byCat[c];
    picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  // Fallback: top up from front if we still don't have 4
  while (picks.length < 4 && front.length > picks.length) {
    const rnd = front[Math.floor(Math.random() * front.length)];
    if (!picks.includes(rnd)) picks.push(rnd);
  }
  return picks.slice(0, 4);
}

function buildHtml(picks) {
  const imgUrls = picks.map(p => fileToFileUrl(path.join(ROOT, p.image)));
  const logoUrl = fileToFileUrl(LOGO_PATH);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    background: #0a0a0a;
    color: #fff;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 1200px;
    height: 630px;
    position: relative;
  }
  .photos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 4px;
    padding: 4px 4px 4px 4px;
    background: #0a0a0a;
  }
  .photos div {
    background-position: center;
    background-size: cover;
    border-radius: 6px;
  }
  .text {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 60px 70px 60px 50px;
    background: linear-gradient(180deg, #ffffff 0%, #f3f3f0 100%);
    color: #0a0a0a;
    position: relative;
  }
  .logo-row {
    display: flex; align-items: center; gap: 18px;
    margin-bottom: 36px;
  }
  .logo-row img {
    width: 60px; height: 60px;
    object-fit: cover;
    object-position: top center;
    /* PNG embeds wordmark; clip lower portion via overflow on wrapper */
  }
  .logo-mark {
    width: 60px; height: 60px;
    overflow: hidden; flex-shrink: 0;
  }
  .logo-mark img {
    width: 60px; height: auto;
    transform: scale(1.35) translateY(-3%);
    transform-origin: center top;
    display: block;
  }
  .brand-name {
    font-size: 32px; font-weight: 700;
    font-family: 'Georgia', serif;
    letter-spacing: 0.5px;
  }
  .brand-name em { font-style: italic; font-weight: 500; margin-left: 4px; color: #555; }
  h1 {
    font-size: 54px;
    line-height: 1.05;
    font-weight: 700;
    margin-bottom: 24px;
    letter-spacing: -0.5px;
  }
  h1 em { font-style: italic; font-weight: 500; color: #444; }
  .sub {
    font-size: 22px;
    line-height: 1.4;
    color: #555;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 400;
    margin-bottom: 40px;
  }
  .footer {
    display: flex; align-items: center; gap: 24px;
    font-size: 18px;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-weight: 600;
    color: #0a0a0a;
  }
  .pill {
    background: #0a0a0a; color: #fff;
    padding: 10px 18px;
    border-radius: 999px;
  }
  .handle { color: #666; font-weight: 500; }
</style></head>
<body>
  <div class="photos">
    <div style="background-image:url('${imgUrls[0]}')"></div>
    <div style="background-image:url('${imgUrls[1]}')"></div>
    <div style="background-image:url('${imgUrls[2]}')"></div>
    <div style="background-image:url('${imgUrls[3]}')"></div>
  </div>
  <div class="text">
    <div class="logo-row">
      <span class="logo-mark"><img src="${logoUrl}" /></span>
      <span class="brand-name">Paparazzi <em>Fashion</em></span>
    </div>
    <h1>Premium Women's Fashion <em>Worldwide</em></h1>
    <div class="sub">Official wholesale supplier &middot; Designed in Poland &middot; Shipped from Istanbul to 80+ countries</div>
    <div class="footer">
      <span class="pill">WhatsApp +90 539 390 99 58</span>
      <span class="handle">@paparazzifashion.tr</span>
    </div>
  </div>
</body></html>`;
}

(async () => {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.error('Missing', PRODUCTS_JSON); process.exit(1);
  }
  if (!fs.existsSync(LOGO_PATH)) {
    console.error('Missing', LOGO_PATH); process.exit(1);
  }
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf-8'));
  const picks = pickFour(products);
  console.log('Picked photos:', picks.map(p => `${p.category}/${p.code}`).join(', '));

  const html = buildHtml(picks);
  const tmpHtml = path.join(ROOT, 'tools', '_og_render.html');
  fs.writeFileSync(tmpHtml, html, 'utf-8');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(fileToFileUrl(tmpHtml), { waitUntil: 'load' });
  // Wait for background-image fetches to actually paint
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT_PATH, type: 'jpeg', quality: 88, fullPage: false, clip: { x:0, y:0, width:1200, height:630 } });
  await browser.close();
  fs.unlinkSync(tmpHtml);
  const stat = fs.statSync(OUT_PATH);
  console.log(`Saved: ${OUT_PATH} (${stat.size} bytes)`);
})();
