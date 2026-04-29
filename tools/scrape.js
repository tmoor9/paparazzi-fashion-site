// Daily scrape of paparazzifashion.com.tr — pulls every product gallery photo,
// downloads new ones, removes nothing on disk (kept as cache), and writes a fresh
// `assets/products.json` reflecting the live catalogue.
//
// Designed to run in GitHub Actions on a cron schedule. Idempotent: re-running it
// when the source has not changed produces an identical products.json.
//
// Run locally:  node tools/scrape.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = 'https://paparazzifashion.com.tr';
const SHOP = ROOT + '/index.php/shop/';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'img', 'products');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'assets', 'products.json');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (resp) => {
      if (resp.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest); } catch (_) {}
        reject(new Error('HTTP ' + resp.statusCode));
        return;
      }
      resp.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err) => { try { fs.unlinkSync(dest); } catch (_) {} reject(err); });
  });
}

// Strip WooCommerce size suffix from image URL: ...-768x1152.jpeg -> ...jpeg
function fullSize(url) {
  return url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
}

async function collectShopUrls(page) {
  // Walk paginated shop pages until we stop discovering new product URLs.
  const all = new Set();
  let pageNum = 1;
  while (pageNum <= 50) {
    const target = pageNum === 1 ? SHOP : `${SHOP}page/${pageNum}/`;
    try {
      const resp = await page.goto(target, { waitUntil: 'networkidle', timeout: 30000 });
      if (!resp || resp.status() === 404) break;
    } catch (e) {
      console.log(`  page ${pageNum} failed: ${e.message}`); break;
    }
    const found = await page.$$eval(
      'a[href*="/product/"]',
      links => [...new Set(links.map(a => a.href).filter(h => /\/product\/[a-z0-9-]+\/$/i.test(h)))]
    );
    let added = 0;
    for (const u of found) { if (!all.has(u)) { all.add(u); added++; } }
    console.log(`  shop page ${pageNum}: +${added} products (total ${all.size})`);
    if (added === 0) break;
    pageNum++;
  }
  return [...all];
}

(async () => {
  console.log('=== Paparazzi Fashion sync ===');
  const t0 = Date.now();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
  });
  const page = await ctx.newPage();

  console.log('Step 1: collect product URLs');
  const productUrls = await collectShopUrls(page);
  console.log(`Total: ${productUrls.length} product URLs`);

  const products = [];
  let downloaded = 0, cached = 0, failed = 0;

  for (let i = 0; i < productUrls.length; i++) {
    const url = productUrls[i];
    process.stdout.write(`[${i + 1}/${productUrls.length}] ${url.replace(ROOT, '')} ... `);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 });

      const heading = await page.locator('h1.product_title, h1').first().textContent().catch(() => '');
      const productName = heading.replace(/Paparazzi Fashion.*/i, '').trim();
      const m = productName.match(/^(Set|Dress|Cardigan|Pants|Top|Coat|Blouse|Shirt|Skirt|Jacket|Sweater|Hoodie|Jumpsuit|Tracksuit|Tunic|Tshirt|T-Shirt|Skort)\s*(\d+)/i);
      if (!m) { console.log(`SKIP (no category): "${productName}"`); continue; }
      let category = m[1].toLowerCase();
      if (category === 't-shirt') category = 'tshirt';
      const code = m[2];
      const varMatch = url.match(/-(\d+)\/?$/);
      const variant = varMatch ? varMatch[1] : '1';

      const galleryImgs = await page.$$eval(
        '.woocommerce-product-gallery__image a, .woocommerce-product-gallery img',
        els => {
          const urls = new Set();
          for (const el of els) {
            const candidates = [
              el.href,
              el.getAttribute && el.getAttribute('href'),
              el.getAttribute && el.getAttribute('data-large_image'),
              el.src,
              el.dataset && el.dataset.src,
              el.dataset && el.dataset.large_image
            ].filter(Boolean);
            for (const c of candidates) {
              if (/\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(c)) urls.add(c);
            }
          }
          return [...urls];
        }
      );

      const seen = new Set();
      const finalUrls = [];
      for (const u of galleryImgs) {
        const f = fullSize(u);
        if (!seen.has(f)) { seen.add(f); finalUrls.push(f); }
      }

      let photoIdx = 0;
      for (const imgUrl of finalUrls) {
        photoIdx++;
        const ext = path.extname(new URL(imgUrl).pathname).split('?')[0] || '.jpg';
        const fileName = `${category}-${code}-v${variant}-p${photoIdx}${ext}`;
        const localPath = path.join(OUT_DIR, fileName);
        if (!fs.existsSync(localPath)) {
          try {
            await download(imgUrl, localPath);
            downloaded++;
          } catch (e) {
            console.log(`\n    !! download failed ${fileName}: ${e.message}`);
            failed++;
            continue;
          }
        } else {
          cached++;
        }
        products.push({
          code, category, variant: String(variant), photo: photoIdx,
          name: productName,
          image: 'assets/img/products/' + fileName,
          sourceUrl: url
        });
      }
      console.log(`${finalUrls.length} photo(s)`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`); failed++;
    }
  }

  // Sort deterministically so JSON only changes when content changes.
  products.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    const ca = parseInt(a.code, 10), cb = parseInt(b.code, 10);
    if (ca !== cb) return ca - cb;
    const va = parseInt(a.variant, 10), vb = parseInt(b.variant, 10);
    if (va !== vb) return va - vb;
    return a.photo - b.photo;
  });

  // Diff against existing JSON for a clean log line.
  let prev = [];
  if (fs.existsSync(PRODUCTS_JSON)) {
    try { prev = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf-8')); } catch (_) {}
  }
  const prevKey = new Set(prev.map(p => p.image));
  const curKey = new Set(products.map(p => p.image));
  const added = products.filter(p => !prevKey.has(p.image)).length;
  const removed = prev.filter(p => !curKey.has(p.image)).length;

  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(products, null, 2) + '\n');

  const byCat = {};
  products.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + 1; });

  console.log(`\n=== Sync complete in ${Math.round((Date.now() - t0) / 1000)}s ===`);
  console.log(`Total photos in catalogue: ${products.length}`);
  console.log(`New (downloaded): ${downloaded}  |  Cached: ${cached}  |  Failed: ${failed}`);
  console.log(`Diff vs previous products.json: +${added} / -${removed}`);
  console.log('By category:', JSON.stringify(byCat));

  await browser.close();
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
