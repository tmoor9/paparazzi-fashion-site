// Generates one static HTML page per product variant under /product/<slug>.html.
//
// Why static HTML and not SPA fragments?
//   - Google indexes individual URLs better than #fragments.
//   - Each page can carry its own <title>, meta description, OG image,
//     and Product JSON-LD — the most powerful signals for product search.
//   - Sharing a link sends the recipient to the exact item, with a rich preview.
//
// Page slug = variantSlug() in build_seo.js  →  "<category>-<code>-v<variant>"
// Output    = product/<slug>.html  (relative path from repo root)
//
// Run locally:  node tools/build_product_pages.js
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SITE = 'https://paparazzifashion.shop';
const PRODUCTS_JSON = path.join(PROJECT_ROOT, 'assets', 'products.json');
const OUT_DIR = path.join(PROJECT_ROOT, 'product');
const WHATSAPP = '905393909958';

// Display names used in titles, descriptions, and JSON-LD.
const CAT_LABEL = {
  set: 'Women\u2019s Set',
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

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(s) { return escHtml(s); }

function variantSlug(v) {
  return `${v.category}-${v.code}-v${v.variant || '1'}`;
}

function loadProducts() {
  if (!fs.existsSync(PRODUCTS_JSON)) {
    console.error('products.json not found:', PRODUCTS_JSON);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8'));
}

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

function buildPage(v) {
  const slug = variantSlug(v);
  const url = `${SITE}/product/${slug}.html`;
  const catLabel = CAT_LABEL[v.category] || 'Apparel';
  const variantSuffix = v.variant && v.variant !== '1' ? ` (variant ${v.variant})` : '';
  const titleName = `${catLabel} ${v.code}${variantSuffix}`;
  const fullTitle = `${titleName} — Paparazzi Fashion Wholesale`;
  const desc =
    `${titleName} from Paparazzi Fashion — official wholesale supplier of women's clothing. ` +
    `Designed in Poland, shipped from Istanbul to 80+ countries. Order on WhatsApp +90 539 390 99 58.`;
  const heroImg = v.photos[0] ? `${SITE}/${v.photos[0].image.replace(/^\/+/, '')}` : `${SITE}/assets/img/og-cover.jpg`;
  const orderText = encodeURIComponent(`Hello, I am interested in ${v.name}${variantSuffix} - wholesale order (code ${v.code})`);
  const whatsappUrl = `https://wa.me/${WHATSAPP}?text=${orderText}`;

  // Product JSON-LD: rich search result eligibility (image carousel, price/availability badge).
  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: titleName,
    sku: `${v.category.toUpperCase()}-${v.code}-V${v.variant || '1'}`,
    mpn: v.code,
    category: catLabel,
    description: desc,
    brand: { '@type': 'Brand', name: 'Paparazzi Fashion' },
    image: v.photos.slice(0, 8).map(ph => `${SITE}/${ph.image.replace(/^\/+/, '')}`),
    url,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      businessFunction: 'http://purl.org/goodrelations/v1#Sell',
      eligibleCustomerType: 'http://purl.org/goodrelations/v1#Business',
      url: whatsappUrl,
      seller: { '@type': 'Organization', name: 'Paparazzi Fashion' },
    },
  };

  // Breadcrumb: Home › Catalog › <Category> › <Product>
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Catalog', item: `${SITE}/#catalog` },
      { '@type': 'ListItem', position: 3, name: catLabel, item: `${SITE}/#catalog?cat=${v.category}` },
      { '@type': 'ListItem', position: 4, name: titleName, item: url },
    ],
  };

  // Gallery: thumbnails + main image; vanilla JS click-swap (no extra deps).
  // <picture> emits WebP for modern browsers, raster fallback for old Safari/IE.
  const photoTags = v.photos.map((ph, i) => {
    const webp = ph.image.replace(/\.(jpe?g|png)$/i, '.webp');
    return `      <picture class="pp-photo${i === 0 ? ' active' : ''}">
        <source srcset="../${escAttr(webp)}" type="image/webp" />
        <img src="../${escAttr(ph.image)}" alt="${escAttr(titleName)} photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" />
      </picture>`;
  }).join('\n');
  const thumbTags = v.photos.length > 1 ? v.photos.map((ph, i) => {
    const webp = ph.image.replace(/\.(jpe?g|png)$/i, '.webp');
    return `        <button type="button" class="pp-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Photo ${i + 1}"><picture><source srcset="../${escAttr(webp)}" type="image/webp" /><img src="../${escAttr(ph.image)}" alt="" loading="lazy" /></picture></button>`;
  }).join('\n') : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(fullTitle)}</title>
<meta name="description" content="${escAttr(desc)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${escAttr(url)}" />

<!-- Open Graph / WhatsApp / Telegram link preview -->
<meta property="og:type" content="product" />
<meta property="og:url" content="${escAttr(url)}" />
<meta property="og:title" content="${escAttr(fullTitle)}" />
<meta property="og:description" content="${escAttr(desc)}" />
<meta property="og:image" content="${escAttr(heroImg)}" />
<meta property="og:site_name" content="Paparazzi Fashion" />
<meta property="og:locale" content="en_US" />
<meta property="product:brand" content="Paparazzi Fashion" />
<meta property="product:availability" content="in stock" />
<meta property="product:condition" content="new" />
<meta property="product:retailer_item_id" content="${escAttr(v.code)}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escAttr(fullTitle)}" />
<meta name="twitter:description" content="${escAttr(desc)}" />
<meta name="twitter:image" content="${escAttr(heroImg)}" />

<!-- Favicons -->
<link rel="icon" type="image/png" sizes="16x16" href="../assets/img/favicon-16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="../assets/img/favicon-180.png" />
<meta name="theme-color" content="#0a0a0a" />

<!-- Structured data: Product + Breadcrumb -->
<script type="application/ld+json">${JSON.stringify(productLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', system-ui, sans-serif; background: #fafafa; color: #0a0a0a; line-height: 1.5; }
img { max-width: 100%; height: auto; display: block; }
a { color: inherit; }
.pp-topbar { background: #0a0a0a; color: #fff; font-size: 13px; padding: 8px 0; text-align: center; }
.pp-header { background: #fff; border-bottom: 1px solid #eee; padding: 16px 24px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 10; }
.pp-header a.pp-back { color: #0a0a0a; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
.pp-header a.pp-back:hover { opacity: .65; }
.pp-header .pp-brand { margin-left: auto; font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; letter-spacing: .5px; }
.pp-header .pp-brand em { font-style: italic; font-weight: 400; opacity: .7; }
.pp-wrap { max-width: 1200px; margin: 0 auto; padding: 32px 24px 80px; display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 48px; }
@media (max-width: 768px) { .pp-wrap { grid-template-columns: 1fr; gap: 24px; padding: 16px; } }
.pp-gallery { position: relative; }
.pp-main { position: relative; aspect-ratio: 3/4; background: #f0f0f0; border-radius: 12px; overflow: hidden; }
.pp-photo { width: 100%; height: 100%; display: none; position: absolute; inset: 0; }
.pp-photo.active { display: block; }
.pp-photo > img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pp-thumb > picture { width: 100%; height: 100%; display: block; }
.pp-thumb > picture > img { width: 100%; height: 100%; object-fit: cover; }
.pp-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,.9); border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.15); transition: background .15s; }
.pp-nav:hover { background: #fff; }
.pp-nav.prev { left: 12px; } .pp-nav.next { right: 12px; }
.pp-nav svg { width: 20px; height: 20px; }
.pp-thumbs { display: flex; gap: 8px; margin-top: 12px; overflow-x: auto; padding-bottom: 4px; }
.pp-thumb { flex: 0 0 64px; aspect-ratio: 3/4; border: 2px solid transparent; border-radius: 6px; padding: 0; background: #f0f0f0; cursor: pointer; overflow: hidden; transition: border-color .15s; }
.pp-thumb.active { border-color: #0a0a0a; }
.pp-thumb img { width: 100%; height: 100%; object-fit: cover; }
.pp-info h1 { font-family: 'Playfair Display', serif; font-size: 36px; font-weight: 700; line-height: 1.1; margin-bottom: 8px; letter-spacing: -.5px; }
.pp-info .pp-code { display: inline-block; font-size: 13px; font-weight: 600; letter-spacing: 1px; color: #666; background: #f0f0f0; padding: 4px 10px; border-radius: 4px; margin-bottom: 24px; }
.pp-info p { color: #555; margin-bottom: 24px; }
.pp-cta { display: inline-flex; align-items: center; gap: 10px; background: #25d366; color: #fff; padding: 14px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; transition: transform .15s, box-shadow .15s; box-shadow: 0 4px 12px rgba(37,211,102,.3); }
.pp-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37,211,102,.4); }
.pp-cta svg { width: 20px; height: 20px; }
.pp-meta { margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee; font-size: 14px; color: #555; }
.pp-meta strong { color: #0a0a0a; font-weight: 600; }
.pp-meta div { padding: 6px 0; }
.pp-related-link { display: inline-block; margin-top: 24px; color: #666; text-decoration: underline; font-size: 14px; }
.pp-related-link:hover { color: #0a0a0a; }
.pp-footer { background: #0a0a0a; color: #aaa; padding: 32px 24px; text-align: center; font-size: 13px; }
.pp-footer a { color: #fff; text-decoration: none; }
</style>
</head>
<body>

<div class="pp-topbar">🌍 Worldwide shipping from Istanbul · Wholesale only</div>

<header class="pp-header">
  <a href="../" class="pp-back">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back to catalog
  </a>
  <span class="pp-brand">Paparazzi <em>Fashion</em></span>
</header>

<main class="pp-wrap">
  <section class="pp-gallery">
    <div class="pp-main" id="pp-main">
${photoTags}
${v.photos.length > 1 ? `      <button type="button" class="pp-nav prev" aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button type="button" class="pp-nav next" aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` : ''}
    </div>
${v.photos.length > 1 ? `    <div class="pp-thumbs">\n${thumbTags}\n    </div>` : ''}
  </section>

  <section class="pp-info">
    <h1>${escHtml(titleName)}</h1>
    <span class="pp-code">CODE #${escHtml(v.code)}${v.variant && v.variant !== '1' ? ` · variant ${escHtml(v.variant)}` : ''}</span>
    <p>${escHtml(desc)}</p>

    <a href="${escAttr(whatsappUrl)}" target="_blank" rel="noopener" class="pp-cta">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
      Order on WhatsApp
    </a>

    <div class="pp-meta">
      <div><strong>Brand:</strong> Paparazzi Fashion (Polish design)</div>
      <div><strong>Category:</strong> ${escHtml(catLabel)}</div>
      <div><strong>Type:</strong> Wholesale / B2B</div>
      <div><strong>Ships from:</strong> Laleli, Istanbul, Turkey</div>
      <div><strong>Delivery:</strong> 3–7 days worldwide (DHL, UPS, EMS)</div>
    </div>

    <a href="../#catalog" class="pp-related-link">← Browse more ${escHtml(catLabel.toLowerCase())}s and other items in the full catalog</a>
  </section>
</main>

<footer class="pp-footer">
  <p>© <span id="y"></span> Paparazzi Fashion · Wholesale women's clothing from Istanbul · <a href="../">paparazzifashion.shop</a></p>
</footer>

<script>
(function(){
  var photos = document.querySelectorAll('.pp-photo');
  var thumbs = document.querySelectorAll('.pp-thumb');
  var prev = document.querySelector('.pp-nav.prev');
  var next = document.querySelector('.pp-nav.next');
  function show(i){
    if(i<0) i = photos.length-1;
    if(i>=photos.length) i = 0;
    photos.forEach(function(p,k){ p.classList.toggle('active', k===i); });
    thumbs.forEach(function(t,k){ t.classList.toggle('active', k===i); });
  }
  thumbs.forEach(function(t){ t.addEventListener('click', function(){ show(parseInt(t.dataset.idx,10)); }); });
  if(prev) prev.addEventListener('click', function(){ var i=[].findIndex.call(photos, function(p){return p.classList.contains('active');}); show(i-1); });
  if(next) next.addEventListener('click', function(){ var i=[].findIndex.call(photos, function(p){return p.classList.contains('active');}); show(i+1); });
  document.getElementById('y').textContent = new Date().getFullYear();
})();
</script>
</body>
</html>
`;
}

(function main() {
  console.log('=== build_product_pages ===');
  const photos = loadProducts();
  const variants = groupVariants(photos);
  console.log(`Loaded ${photos.length} photos → ${variants.length} variants`);

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Track current slugs so orphaned product pages can be deleted.
  const wantedSlugs = new Set();
  let written = 0;
  for (const v of variants) {
    const slug = variantSlug(v);
    wantedSlugs.add(`${slug}.html`);
    const html = buildPage(v);
    const filePath = path.join(OUT_DIR, `${slug}.html`);
    // Only rewrite if changed (saves git churn).
    let same = false;
    if (fs.existsSync(filePath)) {
      try { same = fs.readFileSync(filePath, 'utf8') === html; } catch (_) {}
    }
    if (!same) {
      fs.writeFileSync(filePath, html);
      written++;
    }
  }
  console.log(`Wrote/updated ${written} product page(s) (${variants.length - written} unchanged)`);

  // Delete pages whose product no longer exists in products.json.
  let removed = 0;
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (f.endsWith('.html') && !wantedSlugs.has(f)) {
      fs.unlinkSync(path.join(OUT_DIR, f));
      removed++;
    }
  }
  if (removed) console.log(`Removed ${removed} orphaned page(s)`);

  console.log('=== done ===');
})();
