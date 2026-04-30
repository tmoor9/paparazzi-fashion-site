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
// /shop/ is a curated "featured" page (15 items). The real, complete catalogue
// lives at /shop-2/ + the WooCommerce category pages. We crawl all of them and
// dedupe to capture every product on the origin.
const SHOP_SOURCES = [
  ROOT + '/index.php/shop-2/',
  ROOT + '/index.php/shop/',
  ROOT + '/index.php/product-category/sets/',
  ROOT + '/index.php/product-category/dresses/',
  ROOT + '/index.php/product-category/coat/',
  ROOT + '/index.php/product-category/tops/',
  ROOT + '/index.php/product-category/cardigan/',
  ROOT + '/index.php/product-category/accessories/',
  ROOT + '/index.php/product-category/sale/',
];
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'assets', 'img', 'products');
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'assets', 'products.json');

// Tunables for politeness + resilience.
const DELAY_MIN_MS = 800;       // minimum wait between page navigations
const DELAY_MAX_MS = 2200;      // maximum (random in this range — looks human)
const MAX_RETRIES = 3;          // per-request retry count
const INITIAL_BACKOFF_MS = 4000;
const NAV_TIMEOUT_MS = 35000;

// Pool of realistic User-Agent strings; one is picked per session.
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomDelay() {
  return DELAY_MIN_MS + Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
}

async function withRetries(fn, label) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      const wait = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1)
                 + Math.floor(Math.random() * 1500); // jitter
      console.log(`    retry ${attempt}/${MAX_RETRIES} for ${label}: ${e.message} (wait ${wait}ms)`);
      if (attempt < MAX_RETRIES) await sleep(wait);
    }
  }
  throw lastErr;
}

function download(url, dest, ua) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const req = https.get(url, {
      headers: { 'User-Agent': ua, 'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Referer': ROOT + '/' },
      timeout: 30000,
    }, (resp) => {
      if (resp.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(dest); } catch (_) {}
        reject(new Error('HTTP ' + resp.statusCode));
        return;
      }
      resp.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', (err) => { try { fs.unlinkSync(dest); } catch (_) {} reject(err); });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function downloadWithRetries(url, dest, ua) {
  return withRetries(() => download(url, dest, ua), `download ${path.basename(dest)}`);
}

// Strip WooCommerce size suffix from image URL: ...-768x1152.jpeg -> ...jpeg
function fullSize(url) {
  return url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
}

async function collectFromSource(page, base, all) {
  // Walk paginated pages of a single source (shop or category) until empty.
  const before = all.size;
  let pageNum = 1;
  while (pageNum <= 50) {
    const target = pageNum === 1 ? base : `${base}page/${pageNum}/`;
    try {
      const resp = await withRetries(
        () => page.goto(target, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }),
        `${base.replace(ROOT, '')} page ${pageNum}`
      );
      if (!resp || !resp.ok()) break;
    } catch (e) {
      console.log(`    page ${pageNum} failed: ${e.message}`); break;
    }
    if (/404|not[-_]?found/i.test(await page.title().catch(() => ''))) break;
    const found = await page.$$eval(
      'a[href*="/product/"]',
      links => [...new Set(links.map(a => a.href).filter(h => /\/product\/[a-z0-9-]+\/$/i.test(h)))]
    );
    let addedThisPage = 0;
    for (const u of found) {
      if (!all.has(u)) { all.add(u); addedThisPage++; }
    }
    if (found.length === 0 && pageNum > 1) break;
    if (found.length === 0 && pageNum === 1) break;
    if (addedThisPage === 0 && pageNum > 1) break;
    pageNum++;
    await sleep(randomDelay());
  }
  return all.size - before;
}

async function collectShopUrls(page) {
  // Crawl every shop/category source, dedup across them, return union.
  const all = new Set();
  for (const src of SHOP_SOURCES) {
    const added = await collectFromSource(page, src, all);
    console.log(`  ${src.replace(ROOT, '')}  +${added}  (catalogue total ${all.size})`);
  }
  return [...all];
}

(async () => {
  console.log('=== Paparazzi Fashion sync ===');
  const t0 = Date.now();
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  console.log('Session UA:', ua.replace(/^Mozilla.*?\) /, '').slice(0, 60));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: ua,
    locale: 'en-US',
    timezoneId: 'Europe/Istanbul',
    viewport: { width: 1366, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9,tr;q=0.7',
    },
  });
  // Hide automation fingerprint (webdriver flag)
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
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
      await withRetries(
        () => page.goto(url, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT_MS }),
        `product ${url.replace(ROOT, '')}`
      );

      const heading = await page.locator('h1.product_title, h1').first().textContent().catch(() => '');
      const productName = heading.replace(/Paparazzi Fashion.*/i, '').trim();
      // Try the known-category prefix first; fall back to 'other' so we never drop a product silently.
      const m = productName.match(/^(Set|Dress|Cardigan|Pants|Top|Coat|Blouse|Shirt|Skirt|Jacket|Sweater|Hoodie|Jumpsuit|Tracksuit|Tunic|Tshirt|T-Shirt|Skort)\s*(\d+)/i);
      let category, code;
      if (m) {
        category = m[1].toLowerCase();
        if (category === 't-shirt') category = 'tshirt';
        code = m[2];
      } else {
        category = 'other';
        const codeMatch = productName.match(/(\d{2,5})/);
        code = codeMatch ? codeMatch[1] : '0';
        console.log(`(uncategorised, kept as 'other'): "${productName}"`);
      }
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
            await downloadWithRetries(imgUrl, localPath, ua);
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
    // Be polite — random delay before next product
    await sleep(randomDelay());
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

  // Delete orphaned image files — photos no longer referenced in products.json.
  // Only runs after a successful, non-empty scrape (safety net against accidental wipes).
  let orphanedDeleted = 0;
  if (products.length >= 50 && failed < productUrls.length / 2) {
    const referencedFiles = new Set(products.map(p => path.basename(p.image)));
    if (fs.existsSync(OUT_DIR)) {
      for (const fname of fs.readdirSync(OUT_DIR)) {
        if (!referencedFiles.has(fname)) {
          try {
            fs.unlinkSync(path.join(OUT_DIR, fname));
            orphanedDeleted++;
          } catch (_) {}
        }
      }
    }
  } else {
    console.log('Skipping orphan cleanup (scrape result looks suspicious — too few products or too many failures).');
  }

  const byCat = {};
  products.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + 1; });

  console.log(`\n=== Sync complete in ${Math.round((Date.now() - t0) / 1000)}s ===`);
  console.log(`Total photos in catalogue: ${products.length}`);
  console.log(`New (downloaded): ${downloaded}  |  Cached: ${cached}  |  Failed: ${failed}`);
  console.log(`Diff vs previous products.json: +${added} / -${removed}`);
  console.log(`Orphaned image files deleted: ${orphanedDeleted}`);
  console.log('By category:', JSON.stringify(byCat));

  await browser.close();
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
