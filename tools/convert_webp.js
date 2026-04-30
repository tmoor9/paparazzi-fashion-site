// Converts every product JPG/JPEG/PNG into a sibling .webp at quality 82.
// Strategy:
//   - Output ALWAYS lives next to the source (e.g. dress-001-v1-p1.jpg → dress-001-v1-p1.webp)
//   - Skip if .webp exists AND is newer than source (idempotent → cheap to re-run daily)
//   - Skip files that are already small enough that WebP saves <10% (rare)
//   - Quality 82 is the visual sweet spot for fashion photos (no banding, no halos)
//   - Removes orphaned .webp files whose source is gone (mirrors the cleanup logic for JPGs)
//
// HTML side: main.js + build_product_pages.js emit <picture><source srcset=*.webp>
// with <img src=*.jpg> fallback. Browsers without WebP support (Safari < 14, IE) get JPG.
//
// Run locally:  node tools/convert_webp.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(PROJECT_ROOT, 'assets', 'img', 'products');
const RASTER_RE = /\.(jpe?g|png)$/i;
const QUALITY = 82;          // visual sweet spot
const MIN_SAVING_RATIO = 0.10; // skip if WebP saves less than 10% (already-tiny images)

async function convertOne(srcPath) {
  const webpPath = srcPath.replace(RASTER_RE, '.webp');
  const srcStat = fs.statSync(srcPath);

  // Skip if .webp exists and is newer than source.
  if (fs.existsSync(webpPath)) {
    const webpStat = fs.statSync(webpPath);
    if (webpStat.mtimeMs >= srcStat.mtimeMs) return { skipped: true };
  }

  // Convert.
  const buf = await sharp(srcPath, { failOn: 'none' })
    .rotate()                       // honour EXIF orientation
    .webp({ quality: QUALITY, effort: 4, smartSubsample: true })
    .toBuffer();

  const ratio = 1 - buf.length / srcStat.size;
  // Don't ship a WebP that's BIGGER than the JPG — browser would download more bytes.
  // Happens occasionally for tiny already-optimised images.
  if (buf.length >= srcStat.size) {
    if (fs.existsSync(webpPath)) fs.unlinkSync(webpPath);
    return { skipped: false, rejected: true };
  }
  fs.writeFileSync(webpPath, buf);
  return { skipped: false, srcSize: srcStat.size, webpSize: buf.length, savedPct: Math.round(ratio * 100) };
}

async function main() {
  console.log('=== convert_webp ===');
  if (!fs.existsSync(PRODUCTS_DIR)) {
    console.error('Products dir missing:', PRODUCTS_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(PRODUCTS_DIR);
  const sources = files.filter(f => RASTER_RE.test(f));
  const allWebps = files.filter(f => /\.webp$/i.test(f));

  console.log(`Sources to consider: ${sources.length} (jpg/jpeg/png)`);
  console.log(`Existing webp files: ${allWebps.length}`);

  // Build set of expected webp filenames from sources to detect orphans.
  const expectedWebps = new Set(sources.map(f => f.replace(RASTER_RE, '.webp')));

  let converted = 0, skipped = 0, rejected = 0, totalSrc = 0, totalWebp = 0;
  // Process in chunks of 8 for parallelism without blowing up memory.
  const CHUNK = 8;
  for (let i = 0; i < sources.length; i += CHUNK) {
    const slice = sources.slice(i, i + CHUNK);
    const results = await Promise.all(slice.map(f =>
      convertOne(path.join(PRODUCTS_DIR, f)).catch(e => ({ error: e.message, file: f }))
    ));
    for (const r of results) {
      if (r.error) { console.warn(`  fail: ${r.file}: ${r.error}`); continue; }
      if (r.skipped) { skipped++; continue; }
      if (r.rejected) { rejected++; continue; }
      converted++;
      totalSrc += r.srcSize;
      totalWebp += r.webpSize;
    }
    if ((i + CHUNK) % 80 === 0 || i + CHUNK >= sources.length) {
      process.stdout.write(`  progress: ${Math.min(i + CHUNK, sources.length)}/${sources.length}\r`);
    }
  }
  process.stdout.write('\n');

  // Remove orphan .webp files whose source no longer exists. Skips ones that were
  // shipped as native .webp by the source (no JPG sibling but the .webp itself is canonical).
  let removed = 0;
  for (const w of allWebps) {
    if (expectedWebps.has(w)) continue;
    // Has matching source as raster? If not, leave alone (might be source-native webp).
    const stem = w.replace(/\.webp$/i, '');
    const hasRasterSource = sources.some(f => f.replace(RASTER_RE, '') === stem);
    const hasRasterTwin = ['.jpg', '.jpeg', '.png'].some(ext => fs.existsSync(path.join(PRODUCTS_DIR, stem + ext)));
    if (hasRasterSource || hasRasterTwin) continue; // keep
    // Truly orphan? Only delete if it's clearly ours (e.g. matches our slug pattern).
    // Pattern: <category>-<code>-v<n>-p<n>.webp
    if (/^[a-z]+-[a-z0-9]+-v\d+-p\d+\.webp$/i.test(w)) {
      // Source raster gone → also remove webp.
      fs.unlinkSync(path.join(PRODUCTS_DIR, w));
      removed++;
    }
  }

  console.log(`Converted: ${converted}, skipped (up-to-date): ${skipped}, rejected (webp >= jpg): ${rejected}`);
  if (converted) {
    const saved = totalSrc - totalWebp;
    console.log(`Bandwidth saved: ${(saved / 1024 / 1024).toFixed(1)} MB ` +
                `(${Math.round((saved / totalSrc) * 100)}% reduction across converted set)`);
  }
  if (removed) console.log(`Removed ${removed} orphan .webp file(s)`);
  console.log('=== done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
