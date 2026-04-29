// Main interactivity for Paparazzi Fashion site
(function () {
  'use strict';

  // Year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile menu toggle
  const burger = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  // Initialize Lucide icons (run after DOM ready and after i18n re-renders innerHTML)
  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Wait for lucide script to load (it has `defer`)
  function waitForLucide(attempts) {
    if (window.lucide) {
      refreshIcons();
      return;
    }
    if (attempts > 50) return; // give up after 5s
    setTimeout(() => waitForLucide(attempts + 1), 100);
  }
  waitForLucide(0);

  // Re-init icons after every language change (i18n.js dispatches this event)
  window.addEventListener('pf:lang-changed', () => {
    // Wait for next paint so innerHTML mutations settle
    requestAnimationFrame(refreshIcons);
  });
  // Also expose refreshIcons globally for external triggers
  window.pfRefreshIcons = refreshIcons;

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const top = target.getBoundingClientRect().top + window.pageYOffset - headerHeight - 10;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // ============ HERO IMAGE (single random pick — no slideshow) ============
  async function initHeroImage() {
    const wrap = document.getElementById('hero-slideshow');
    if (!wrap) return;
    let photos;
    try {
      const resp = await fetch('assets/products.json', { cache: 'force-cache' });
      if (!resp.ok) return;
      photos = await resp.json();
    } catch (_) { return; }
    if (!Array.isArray(photos) || photos.length === 0) return;
    // Only consider the first photo of each variant (front-pose) for a clean hero.
    const candidates = photos.filter(p => (p.photo || 1) === 1);
    if (!candidates.length) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const img = wrap.querySelector('img.hero-slide');
    if (img) {
      img.src = pick.image;
      img.alt = `Paparazzi Fashion ${pick.name}`;
      img.classList.add('active');
    }
  }
  initHeroImage();

  // ============ CATALOG (dynamic from products.json) ============
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildCardHtml(v) {
    const variantSuffix = v.variant && v.variant !== '1' ? ` (variant ${v.variant})` : '';
    const orderText = encodeURIComponent(`Hello, I am interested in ${v.name}${variantSuffix} - wholesale order`);
    let codeText = `#${v.code}`;
    if (v.variant && v.variant !== '1') codeText += ` · v${v.variant}`;
    const catName = v.category.charAt(0).toUpperCase() + v.category.slice(1);
    const photos = v.photos.map((ph, i) =>
      `<img src="${escapeAttr(ph.image)}" alt="${escapeAttr(v.name)} photo ${i+1}" class="product-photo${i===0?' active':''}" loading="lazy" />`
    ).join('');
    const hasGallery = v.photos.length > 1;
    const dots = hasGallery
      ? `<div class="product-dots">${v.photos.map((_, i) => `<button type="button" class="dot${i===0?' active':''}" data-idx="${i}" aria-label="Photo ${i+1}"></button>`).join('')}</div>`
      : '';
    const navArrows = hasGallery
      ? `<button type="button" class="nav-btn nav-prev" aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>
         <button type="button" class="nav-btn nav-next" aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></button>
         <span class="photo-counter">1 / ${v.photos.length}</span>`
      : '';
    return `
      <a href="https://wa.me/905393909958?text=${orderText}" target="_blank" rel="noopener"
         class="product-card" data-category="${escapeAttr(v.category)}" data-code="${escapeAttr(v.code)}" data-variant="${escapeAttr(v.variant || '1')}">
        <div class="product-image">
          <div class="product-photos">${photos}</div>
          <span class="product-badge" data-i18n="cat.${escapeAttr(v.category)}">${escapeAttr(v.category.toUpperCase())}</span>
          ${navArrows}
          ${dots}
        </div>
        <div class="product-body">
          <div>
            <h3 class="product-name" data-i18n="cat.${escapeAttr(v.category)}.name">${escapeAttr(catName)}</h3>
            <span class="product-code">${escapeAttr(codeText)}</span>
          </div>
          <span class="product-cta" aria-label="Order on WhatsApp">
            <i data-lucide="message-circle"></i>
          </span>
        </div>
      </a>
    `;
  }

  // Delegate gallery clicks (prev/next/dots) — must intercept before <a> default
  function attachGalleryHandlers() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.addEventListener('click', (e) => {
      const navBtn = e.target.closest('.nav-btn');
      const dot = e.target.closest('.dot');
      if (!navBtn && !dot) return;
      e.preventDefault();
      e.stopPropagation();
      const card = (navBtn || dot).closest('.product-card');
      if (!card) return;
      const photos = card.querySelectorAll('.product-photo');
      const dots = card.querySelectorAll('.dot');
      const counter = card.querySelector('.photo-counter');
      let idx = [...photos].findIndex(p => p.classList.contains('active'));
      if (idx < 0) idx = 0;
      if (navBtn) {
        idx = navBtn.classList.contains('nav-next')
          ? (idx + 1) % photos.length
          : (idx - 1 + photos.length) % photos.length;
      } else {
        idx = parseInt(dot.dataset.idx, 10) || 0;
      }
      photos.forEach((p, i) => p.classList.toggle('active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      if (counter) counter.textContent = `${idx + 1} / ${photos.length}`;
    });
  }

  function attachFilterListeners() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    const allCards = document.querySelectorAll('.product-card');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const filter = tab.dataset.filter || 'all';
        filterTabs.forEach(t => t.classList.toggle('active', t === tab));
        allCards.forEach(card => {
          const matches = filter === 'all' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !matches);
        });
      });
    });
  }

  function updateFilterCounts(products) {
    const counts = { all: products.length };
    products.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    document.querySelectorAll('.filter-tab').forEach(tab => {
      const f = tab.dataset.filter;
      const countEl = tab.querySelector('.count');
      if (countEl && counts[f] !== undefined) countEl.textContent = `(${counts[f]})`;
      // Hide filter tab if no products in that category
      if (f !== 'all' && (!counts[f] || counts[f] === 0)) {
        tab.style.display = 'none';
      }
    });
  }

  async function initCatalog() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    let photos;
    try {
      const resp = await fetch('assets/products.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      photos = await resp.json();
    } catch (e) {
      console.error('[catalog] Failed to load products.json:', e);
      grid.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">Catalog unavailable.</p>';
      return;
    }
    if (!Array.isArray(photos) || !photos.length) {
      grid.innerHTML = '<p style="text-align:center;color:#999;padding:40px;">No products yet.</p>';
      return;
    }
    // Group photos into variants: one card per (category + code + variant).
    const variantMap = new Map();
    for (const p of photos) {
      const key = `${p.category}|${p.code}|${p.variant || '1'}`;
      if (!variantMap.has(key)) {
        variantMap.set(key, {
          category: p.category, code: p.code, variant: p.variant || '1',
          name: p.name, sourceUrl: p.sourceUrl, photos: []
        });
      }
      variantMap.get(key).photos.push({ image: p.image, photo: p.photo || 1 });
    }
    const variants = [...variantMap.values()];
    variants.forEach(v => v.photos.sort((a, b) => a.photo - b.photo));
    // Strict order: sets → dresses → shirts → t-shirts → tunics → jackets → cardigans.
    const catOrder = { set: 0, dress: 1, shirt: 2, tshirt: 3, tunic: 4, jacket: 5, cardigan: 6 };
    variants.sort((a, b) => {
      const oa = catOrder[a.category] ?? 99;
      const ob = catOrder[b.category] ?? 99;
      if (oa !== ob) return oa - ob;
      const ca = parseInt(a.code, 10), cb = parseInt(b.code, 10);
      if (ca !== cb) return ca - cb;
      const va = parseInt(a.variant || '1', 10), vb = parseInt(b.variant || '1', 10);
      return va - vb;
    });
    grid.innerHTML = variants.map(buildCardHtml).join('');
    updateFilterCounts(variants);
    attachFilterListeners();
    attachGalleryHandlers();
    refreshIcons();
    // Re-run translations so newly inserted data-i18n elements get the current language
    if (typeof window.setLanguage === 'function') {
      const currentLang = document.documentElement.dataset.lang || 'en';
      window.setLanguage(currentLang);
    }
  }
  initCatalog();

  // Intersection Observer — fade-in animations
  if ('IntersectionObserver' in window) {
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.cat-card, .ws-card, .gal-item, .contact-card').forEach(el => {
      fadeObserver.observe(el);
    });
  }
})();
