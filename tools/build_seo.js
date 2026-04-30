// Builds three SEO artefacts from assets/products.json:
//   1. sitemap.xml          — homepage + per-product anchor URL + hreflang for EN/TR/RU,
//                             plus an Image sitemap entry per product photo.
//   2. assets/products-ld.json — JSON-LD ItemList of every product (consumed by index.html
//                                via fetch + injected <script type="application/ld+json">).
//   3. {indexnow-key}.txt   — IndexNow key file at site root for Bing/Yandex verification.
// After writing files, the script optionally pings IndexNow if INDEXNOW=1.
//
// Run locally:  node tools/build_seo.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITE = 'https://paparazzifashion.shop';
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'assets', 'products.json');
const SITEMAP_XML = path.join(PROJECT_ROOT, 'sitemap.xml');
const PRODUCTS_LD = path.join(PROJECT_ROOT, 'assets', 'products-ld.json');

// Stable key per site — must match the file at /<key>.txt
const INDEXNOW_KEY = 'paparazzi9f3a72b1c4d8e0f1a2b3c4d5e6f70123';

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.error('products.json not found:', PRODUCTS_JSON);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
}

// Group photos per (category, code, variant) just like the front-end does.
function groupVariants(photos) {
  const map = new Map();
  for (const p of photos) {
    const key = `${p.category}|${p.code}|${p.variant || '1'}`;
    if (!map.has(key)) {
      map.set(key, {
        category: p.category, code: p.code, variant: p.variant || '1',
        name: p.name, sourceUrl: p.sourceUrl, photos: [],
      });
    }
    map.get(key).photos.push({ image: p.image, photo: p.photo || 1 });
  }
  for (const v of map.values()) v.photos.sort((a, b) => a.photo - b.photo);
  return [...map.values()];
}

// SPA-friendly per-product anchor URL. Google treats fragments as same page,
// but other crawlers (Bing, Yandex) follow them, and they're useful for sharing.
function variantSlug(v) {
  return `${v.category}-${v.code}-v${v.variant}`;
}

function buildSitemap(variants) {
  const today = isoDate();
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  lines.push('        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">');

  // Homepage
  lines.push('  <url>');
  lines.push(`    <loc>${SITE}/</loc>`);
  lines.push(`    <lastmod>${today}</lastmod>`);
  lines.push('    <changefreq>daily</changefreq>');
  lines.push('    <priority>1.0</priority>');
  lines.push(`    <xhtml:link rel="alternate" hreflang="en" href="${SITE}/?lang=en"/>`);
  lines.push(`    <xhtml:link rel="alternate" hreflang="tr" href="${SITE}/?lang=tr"/>`);
  lines.push(`    <xhtml:link rel="alternate" hreflang="ru" href="${SITE}/?lang=ru"/>`);
  lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`);
  // Up to 1000 image entries are allowed per <url>.
  let imgCount = 0;
  for (const v of variants) {
    for (const ph of v.photos) {
      if (imgCount >= 1000) break;
      const abs = `${SITE}/${ph.image.replace(/^\/+/, '')}`;
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escXml(abs)}</image:loc>`);
      lines.push(`      <image:title>${escXml(v.name)}</image:title>`);
      lines.push('      <image:caption>Paparazzi Fashion wholesale women clothing — ' + escXml(v.name) + '</image:caption>');
      lines.push('    </image:image>');
      imgCount++;
    }
    if (imgCount >= 1000) break;
  }
  lines.push('  </url>');

  // Per-variant dedicated page (built by tools/build_product_pages.js).
  // Static URLs index much better than #fragments and surface in image search.
  for (const v of variants) {
    const slug = variantSlug(v);
    lines.push('  <url>');
    lines.push(`    <loc>${SITE}/product/${slug}.html</loc>`);
    lines.push(`    <lastmod>${today}</lastmod>`);
    lines.push('    <changefreq>weekly</changefreq>');
    lines.push('    <priority>0.7</priority>');
    for (const ph of v.photos.slice(0, 10)) {
      const abs = `${SITE}/${ph.image.replace(/^\/+/, '')}`;
      lines.push('    <image:image>');
      lines.push(`      <image:loc>${escXml(abs)}</image:loc>`);
      lines.push(`      <image:title>${escXml(v.name)}</image:title>`);
      lines.push('    </image:image>');
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return lines.join('\n') + '\n';
}

function buildProductsLd(variants) {
  // ItemList of WholesaleProduct entries (Google understands it for product listings).
  const items = variants.map((v, i) => {
    const slug = variantSlug(v);
    const images = v.photos.slice(0, 8).map(ph => `${SITE}/${ph.image.replace(/^\/+/, '')}`);
    const catMap = {
      set: 'Women\u2019s clothing set',
      dress: 'Dress',
      shirt: 'Shirt',
      tshirt: 'T-shirt',
      tunic: 'Tunic',
      jacket: 'Jacket',
      cardigan: 'Cardigan',
      coat: 'Coat',
      top: 'Top',
      blouse: 'Blouse',
      skirt: 'Skirt',
      pants: 'Pants',
      sweater: 'Sweater',
      hoodie: 'Hoodie',
      jumpsuit: 'Jumpsuit',
      tracksuit: 'Tracksuit',
      skort: 'Skort',
      other: 'Apparel',
    };
    return {
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: v.name,
        sku: `${v.category.toUpperCase()}-${v.code}-V${v.variant}`,
        category: catMap[v.category] || 'Apparel',
        brand: { '@type': 'Brand', name: 'Paparazzi Fashion' },
        image: images,
        url: `${SITE}/product/${slug}.html`,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          businessFunction: 'http://purl.org/goodrelations/v1#Sell',
          eligibleCustomerType: 'http://purl.org/goodrelations/v1#Business',
          url: `https://wa.me/905393909958?text=${encodeURIComponent('Hello, I am interested in ' + v.name + ' - wholesale order')}`,
        },
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Paparazzi Fashion Wholesale Catalog',
    numberOfItems: items.length,
    itemListElement: items,
  };
}

function pingIndexNow(urls) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      host: 'paparazzifashion.shop',
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    });
    const req = https.request({
      method: 'POST',
      hostname: 'api.indexnow.org',
      path: '/IndexNow',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        console.log('  IndexNow: HTTP', res.statusCode, body ? body.slice(0, 120) : '(no body)');
        resolve();
      });
    });
    req.on('error', (e) => { console.log('  IndexNow error:', e.message); resolve(); });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('=== build_seo ===');
  const photos = loadProducts();
  const variants = groupVariants(photos);
  console.log(`Loaded ${photos.length} photos, ${variants.length} variants`);

  // 1. sitemap.xml
  const sitemap = buildSitemap(variants);
  fs.writeFileSync(SITEMAP_XML, sitemap);
  console.log(`Wrote sitemap.xml (${(sitemap.length / 1024).toFixed(1)} KB, ${variants.length + 1} URLs)`);

  // 2. products-ld.json
  const ld = buildProductsLd(variants);
  fs.writeFileSync(PRODUCTS_LD, JSON.stringify(ld, null, 2) + '\n');
  console.log(`Wrote assets/products-ld.json (${variants.length} products in ItemList)`);

  // 3. IndexNow key file
  const keyFile = path.join(PROJECT_ROOT, `${INDEXNOW_KEY}.txt`);
  fs.writeFileSync(keyFile, INDEXNOW_KEY + '\n');
  console.log(`Wrote ${INDEXNOW_KEY}.txt (IndexNow ownership proof)`);

  // 4. Optional: ping IndexNow API (Bing, Yandex, Seznam, Naver — all subscribe to the same feed).
  if (process.env.INDEXNOW === '1') {
    console.log('Pinging IndexNow with homepage + sitemap + first 50 product URLs...');
    const urls = [
      `${SITE}/`,
      `${SITE}/sitemap.xml`,
      ...variants.slice(0, 48).map(v => `${SITE}/product/${variantSlug(v)}.html`),
    ];
    await pingIndexNow(urls);
  } else {
    console.log('(Skipping IndexNow ping — set INDEXNOW=1 to enable)');
  }

  console.log('=== done ===');
})();
