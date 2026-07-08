const $ = (id) => document.getElementById(id);

/* Supabase Storage image transform — serves a properly-sized/compressed
 * render instead of the full-size original (originals are ~1024px source
 * images; grid thumbnails only display at ~260px, so requesting the
 * original there was ~170KB of pure waste per image). */
function sizedImage(url, width, quality = 72) {
  return url.replace('/object/public/', `/render/image/public/`) + `?width=${width}&quality=${quality}`;
}
const TIER_MAP = {
  'All plans': 'All plans (Launch, Dominate, Own Your Market)',
  'Launch and up': 'Launch and up',
  'Dominate and up': 'Dominate and up',
};

/* ── Toast ─────────────────────────────────────────────────────────── */
function toast(msg) {
  const el = $('demoToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3600);
}

/* ── Tour mode ─────────────────────────────────────────────────────── */
const TOUR_CONTENT = {
  visualizer: { title: 'AI Visualizer + Instant Pricing', body: 'A homeowner uploads a photo and gets a real, priced estimate in seconds — no phone call, no awkward ask. This is the same engine that runs on epoxygrind.com, embedded directly on your site.' },
  trust: { title: 'Trust Builders Above the Fold', body: 'License, insurance, warranty, and rating badges sit right where a homeowner is deciding whether to trust you — not buried three scrolls down.' },
  reviews: { title: 'Review Sync + Review-Generation Automation', body: 'Your real Google reviews sync here automatically. After every completed job, your customer gets an automated text asking for a review — building your rating without you lifting a finger.' },
  'seo-pages': { title: 'SEO Service-Page Architecture', body: 'Each service gets its own ranking page — not just a card on the homepage. That means separate search visibility for "residential epoxy floors near me," "commercial floor coatings," and every other service you offer.' },
  process: { title: 'Fewer Tire-Kicker Calls', body: 'Explaining your process up front — especially mechanical prep vs. a cheap acid-etch shortcut — educates the right buyers and filters out the ones who just want the lowest number.' },
  gallery: { title: 'Gallery + Visualizer Are One System', body: 'Every image in this gallery came from the same AI engine as the hero estimator. Every finish type shows multiple real-looking floors, filterable by space and finish.' },
  'content-depth': { title: 'Content Depth = SEO + Buyer Education', body: 'Dedicated pages explaining each finish type capture long-tail searches ("metallic epoxy garage floor") and pre-sell the buyer before they ever call.' },
  founder: { title: 'Founder Story Converts', body: 'People hire people, not companies. A real founder story — even a short one — measurably increases quote-to-close rate versus a faceless "About Us" paragraph.' },
  video: { title: 'Video Without the Speed Penalty', body: 'Install and timelapse video builds trust fast, but a raw embed can tank your Lighthouse score. We handle compression and lazy-loading so you get the video without the speed hit.' },
  'local-seo': { title: 'Local SEO City Pages', body: 'On Dominate and Own Your Market, every suburb you serve gets its own dedicated landing page — instead of one homepage trying (and failing) to rank for every city at once.' },
  'risk-reversal': { title: 'Risk Reversal + Financing Widen the Buyer Pool', body: 'A clear warranty and a financing option remove two of the biggest reasons a homeowner hesitates on a $3-8k purchase.' },
  'faq-seo': { title: 'FAQs Capture Long-Tail Searches', body: 'Questions like "epoxy vs. polyaspartic" or "can you coat over old epoxy" are real searches homeowners make — answering them here both ranks and cuts down repetitive phone calls.' },
  'lead-form': { title: 'Every Path Ends in a Lead', body: 'Every CTA on this page — nav, hero, mid-page, footer — routes to this same form. On your site, it hits your inbox and CRM instantly instead of getting lost.' },
  speed: { title: 'Speed Is the First Gate', body: 'A homeowner can bounce before a slow site even finishes loading. Every site we build is held to this same Lighthouse bar before it goes live.' },
  'click-to-call': { title: 'Click-to-Call', body: 'One tap dials your business line directly from a search result or the site itself — the highest-intent action a mobile visitor can take.' },
  social: { title: 'Social Integration', body: "On your site, these icons link to your real Instagram and Facebook profiles — we'll also set up and optimize them if you don't already have them." },
  'mobile-cta': { title: 'Mobile Sticky CTA Bar', body: "A persistent Call + Get Estimate bar at the bottom of the screen on mobile — a proven conversion pattern most contractor sites (including the one we modeled this structure on) don't have." },
};
const TOUR_ORDER = ['visualizer', 'click-to-call', 'social', 'mobile-cta', 'trust', 'reviews', 'seo-pages', 'process', 'gallery', 'content-depth', 'founder', 'video', 'local-seo', 'risk-reversal', 'faq-seo', 'lead-form', 'speed'];

function initTour() {
  const toggle = $('tourToggle');
  const popover = $('tourPopover');
  const closeBtn = $('tourClose');
  const nextBtn = $('tourNext');
  let currentIndex = -1;

  function applyToggleState() {
    document.body.classList.toggle('tour-off', !toggle.checked);
  }
  toggle.addEventListener('change', applyToggleState);
  applyToggleState();

  function openTour(id) {
    const content = TOUR_CONTENT[id];
    if (!content) return;
    currentIndex = TOUR_ORDER.indexOf(id);
    $('tourTier').textContent = content.tier || TIER_MAP[document.querySelector(`[data-tour="${id}"]`)?.dataset.tier] || document.querySelector(`[data-tour="${id}"]`)?.dataset.tier || '';
    $('tourTitle').textContent = content.title;
    $('tourBody').textContent = content.body;
    popover.classList.add('open');
  }

  document.querySelectorAll('[data-tour]').forEach((badge) => {
    badge.addEventListener('click', () => openTour(badge.dataset.tour));
  });

  closeBtn.addEventListener('click', () => popover.classList.remove('open'));
  popover.addEventListener('click', (e) => { if (e.target === popover) popover.classList.remove('open'); });
  nextBtn.addEventListener('click', () => {
    const next = TOUR_ORDER[(currentIndex + 1) % TOUR_ORDER.length];
    openTour(next);
    const el = document.querySelector(`[data-tour="${next}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // click-to-call + social toasts (also tour-relevant callouts, not full badges)
  const callLink = $('navCallLink');
  if (callLink) {
    callLink.addEventListener('click', (e) => {
      e.preventDefault();
      toast(callLink.dataset.tourToast);
    });
  }
  document.querySelectorAll('[data-social-toast]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      toast("On your site, these link to your real profiles — we also set up and optimize them if you don't have them.");
    });
  });
}

/* ── Reviews (sample, clearly labeled) ────────────────────────────── */
const REVIEWS = [
  { name: 'John D.', rating: 5, time: '2 weeks ago', text: 'Grind, not etch — they explained the difference and it shows. Floor looks incredible a year later, zero peeling.', reply: false },
  { name: 'Jane D.', rating: 5, time: '1 month ago', text: 'Got a text back within a minute of filling out the form. Crew showed up on time, floor was done in two days.', reply: 'Thanks Jane — appreciate you taking the time!' },
  { name: 'Mike R.', rating: 5, time: '1 month ago', text: 'Metallic finish in the showroom turned out better than the sample photos. Customers ask about it constantly.', reply: false },
  { name: 'Sara P.', rating: 4, time: '2 months ago', text: 'Good work overall, took one extra day due to weather delaying the cure. Communication could have been a touch faster.', reply: 'Appreciate the honest feedback, Sara — we\'ve tightened up our weather-delay updates since.' },
  { name: 'Tom K.', rating: 5, time: '2 months ago', text: 'Basement floor had a moisture problem another contractor missed. These guys caught it and handled it right.', reply: false },
  { name: 'Amy L.', rating: 5, time: '3 months ago', text: 'Free estimate was accurate to the dollar. No surprise charges when the invoice came.', reply: false },
];
const AVATAR_COLORS = ['#1A5CD6', '#0F3E96', '#647189', '#DD2C2C', '#0F2C5C', '#42506B'];
function renderReviews() {
  const grid = $('reviewGrid');
  if (!grid) return;
  grid.innerHTML = REVIEWS.map((r, i) => `
    <div class="review-card reveal">
      <div class="review-top">
        <div class="review-avatar" style="background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${r.name.charAt(0)}</div>
        <div><div class="review-name">${r.name}</div><div class="review-time">${r.time}</div></div>
      </div>
      <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
      <p class="review-text">${r.text}</p>
      ${r.reply ? `<div class="review-reply"><b>Response from owner:</b> ${r.reply}</div>` : ''}
      <span class="review-footer">Sample review for demonstration</span>
    </div>`).join('');
  document.querySelectorAll('#reviewGrid .reveal').forEach((el) => revealObserver.observe(el));
}

/* ── FAQ ───────────────────────────────────────────────────────────── */
const FAQS = [
  { q: 'How much does an epoxy floor cost?', a: 'Most residential garages run $4-9 per square foot depending on system — solid epoxy is the least expensive, metallic and full-flake systems run higher. A typical 2-car garage (about 450 sq ft) lands in the $2,200-$3,800 range installed.' },
  { q: 'Epoxy vs. polyaspartic — what\'s the difference?', a: 'Polyaspartic cures in hours instead of days and holds up better to UV and hot tires, but costs more per square foot. Epoxy is the better value for a garage that stays out of direct sun; polyaspartic is worth the premium for a space that sees a lot of sun or heavy vehicle traffic.' },
  { q: 'Why does mechanical prep (grinding) matter?', a: 'Acid etching only lightly roughens the surface and can leave a residue that blocks adhesion. Diamond grinding physically opens the concrete\'s pores so the coating mechanically bonds — it\'s the single biggest factor in whether a floor lasts 15 years or peels in one.' },
  { q: 'How long does installation take, and how long until I can park on it?', a: 'Most residential jobs take 2-3 days start to finish. You can walk on the floor after 24 hours, but we recommend waiting a full 5-7 days before parking a vehicle on it so the coating fully cures.' },
  { q: 'Can you coat over an old, existing coating?', a: 'Sometimes — it depends on how well the old coating is still bonded. If it\'s peeling or delaminating anywhere, that has to come off first; coating over a failing floor just guarantees the new one fails too. We check this during the free consultation.' },
  { q: 'What if my concrete is cracked or damaged?', a: 'Hairline cracks get filled and profiled as part of standard prep. Larger structural cracks or significant spalling may need repair work first, which we\'ll flag and price separately before starting the coating.' },
  { q: 'Do you offer a warranty?', a: 'Yes — every install carries a 1-year workmanship warranty. If our prep or application fails, we come back and fix it at no charge.' },
  { q: 'Can I get a custom color or a logo inlaid in the floor?', a: 'Yes — custom color blends and logo inlays (team logos, business branding) are both available as part of our decorative concrete service.' },
];
function renderFaqs() {
  const list = $('faqList');
  if (!list) return;
  list.innerHTML = FAQS.map((f, i) => `
    <div class="faq-item${i === 0 ? ' open' : ''}">
      <button type="button" class="faq-q" aria-expanded="${i === 0 ? 'true' : 'false'}">${f.q}<span class="plus">+</span></button>
      <div class="faq-a"><p>${f.a}</p></div>
    </div>`).join('');
  list.querySelectorAll('.faq-item').forEach((item) => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const wasOpen = item.classList.contains('open');
      list.querySelectorAll('.faq-item').forEach((i) => { i.classList.remove('open'); i.querySelector('.faq-q').setAttribute('aria-expanded', 'false'); });
      if (!wasOpen) { item.classList.add('open'); item.querySelector('.faq-q').setAttribute('aria-expanded', 'true'); }
    });
  });
}

/* ── Gallery ───────────────────────────────────────────────────────── */
let galleryData = [];
let activeSpace = 'all';
let activeFinish = 'all';

async function loadGallery() {
  try {
    const res = await fetch('/demo/gallery.json');
    if (!res.ok) return;
    const data = await res.json();
    galleryData = data.pairs || [];
  } catch {
    galleryData = [];
  }
  if (!galleryData.length) return;

  const spaces = [...new Map(galleryData.map((p) => [p.space, p.spaceLabel])).entries()];
  const finishes = [...new Map(galleryData.map((p) => [p.finish, p.finishLabel])).entries()];

  $('spaceFilters').innerHTML = `<button class="g-chip-btn active" data-space="all">All spaces</button>` +
    spaces.map(([id, label]) => `<button class="g-chip-btn" data-space="${id}">${label}</button>`).join('');
  $('finishFilters').innerHTML = `<button class="g-chip-btn active" data-finish="all">All finishes</button>` +
    finishes.map(([id, label]) => `<button class="g-chip-btn" data-finish="${id}">${label.split(' (')[0]}</button>`).join('');

  $('spaceFilters').querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
    activeSpace = btn.dataset.space;
    $('spaceFilters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    renderGalleryGrid();
  }));
  $('finishFilters').querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
    activeFinish = btn.dataset.finish;
    $('finishFilters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    renderGalleryGrid();
  }));

  document.querySelectorAll('[data-filter-finish]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const finishPrefix = a.dataset.filterFinish;
      const match = finishes.find(([id]) => id.startsWith(finishPrefix));
      if (match) {
        activeFinish = match[0];
        $('finishFilters').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.finish === match[0]));
        renderGalleryGrid();
      }
      document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
    });
  });

  renderGalleryHero(galleryData[0]);
  renderGalleryGrid();
}

function renderGalleryHero(pair) {
  if (!pair) return;
  const hero = $('galleryHero');
  hero.querySelector('.g-before-img').src = sizedImage(pair.before, 1024, 78);
  hero.querySelector('.g-after-img').src = sizedImage(pair.after, 1024, 78);
}

function renderGalleryGrid() {
  const grid = $('galleryGrid');
  const filtered = galleryData.filter((p) => (activeSpace === 'all' || p.space === activeSpace) && (activeFinish === 'all' || p.finish === activeFinish));
  grid.innerHTML = filtered.map((p, i) => `
    <div class="gallery-item" data-index="${galleryData.indexOf(p)}">
      <img src="${sizedImage(p.after, 320)}" alt="${p.spaceLabel} — ${p.finishLabel}" loading="lazy">
      <span class="tag">${p.spaceLabel}</span>
    </div>`).join('');
  grid.querySelectorAll('.gallery-item').forEach((item) => {
    item.addEventListener('click', () => openLightbox(galleryData[Number(item.dataset.index)]));
  });
}

function openLightbox(pair) {
  if (!pair) return;
  $('lightboxImg').src = sizedImage(pair.after, 1024, 78);
  $('lightboxTitle').textContent = `${pair.spaceLabel} — ${pair.finishLabel}`;
  $('lightboxSub').textContent = 'Generated with the EpoxyGrind visualizer.';
  $('lightbox').classList.add('open');
  renderGalleryHero(pair);
}
function initLightbox() {
  $('lightboxClose').addEventListener('click', () => $('lightbox').classList.remove('open'));
  $('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') $('lightbox').classList.remove('open'); });
}

/* Draggable gallery hero slider (self-contained, no cross-directory import) */
function initGallerySlider() {
  const root = $('galleryHero');
  const afterWrap = root.querySelector('.after-wrap');
  const divider = root.querySelector('.g-divider');
  let dragging = false;
  function setPct(pct) {
    pct = Math.min(100, Math.max(0, pct));
    afterWrap.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    divider.style.left = `${pct}%`;
  }
  function pctFromX(x) {
    const rect = root.getBoundingClientRect();
    return ((x - rect.left) / rect.width) * 100;
  }
  root.addEventListener('pointerdown', (e) => { dragging = true; root.setPointerCapture(e.pointerId); setPct(pctFromX(e.clientX)); });
  root.addEventListener('pointermove', (e) => { if (dragging) setPct(pctFromX(e.clientX)); });
  root.addEventListener('pointerup', (e) => { dragging = false; try { root.releasePointerCapture(e.pointerId); } catch { /* noop */ } });
  setPct(50);
}

/* ── Estimator (real analysis via /api/analyze, no account created) ─ */
let uploadedImage = '';
async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function runEstimate(imageDataUrl) {
  const status = $('estStatus');
  const errorEl = $('estError');
  const result = $('estResult');
  errorEl.classList.remove('show');
  result.classList.remove('show');
  status.classList.add('show');
  status.textContent = 'Analyzing your photo… (~15-20s)';

  try {
    // /api/analyze (parseEstimateInput + buildPricingEstimate) requires a
    // ZIP for regional pricing — the demo isn't quoting a real address, so
    // a fixed placeholder ZIP keeps the real analysis+pricing engine
    // running without adding a ZIP-entry step the source doc doesn't call for.
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageDataUrl, finish: 'flake', coatingType: 'epoxy', location: '90210' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong — try another photo.');

    status.classList.remove('show');
    const low = data.pricing?.totalLow;
    const high = data.pricing?.totalHigh;
    $('estPrice').textContent = (low && high) ? `$${Number(low).toLocaleString()}–$${Number(high).toLocaleString()}` : 'See analysis below';
    $('estSummary').textContent = data.analysis?.analysisSummary || '';
    result.classList.add('show');
  } catch (err) {
    status.classList.remove('show');
    errorEl.textContent = err.message || 'Something went wrong — try another photo.';
    errorEl.classList.add('show');
  }
}

function initEstimator() {
  const uploadZone = $('estUpload');
  const input = $('estPhotoInput');
  const preview = $('estPreview');
  const previewImg = $('estPreviewImg');

  uploadZone.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploadedImage = await fileToDataUrl(file);
    previewImg.src = uploadedImage;
    preview.hidden = false;
    runEstimate(uploadedImage);
  });

  document.querySelectorAll('#estSamples button').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const img = btn.querySelector('img');
      previewImg.src = img.src;
      preview.hidden = false;
      // Sample photos run the real generation against the sample image URL —
      // fetch it client-side and convert to a data URL so /api/analyze gets
      // real image bytes, same as an uploaded photo (never a fake canned result).
      try {
        const resp = await fetch(img.src);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => { uploadedImage = reader.result; runEstimate(uploadedImage); };
        reader.readAsDataURL(blob);
      } catch {
        $('estError').textContent = 'Could not load sample photo — try uploading your own.';
        $('estError').classList.add('show');
      }
    });
  });

  $('estToggleCalc').addEventListener('click', () => {
    $('calcQuick').classList.toggle('show');
  });

  $('qCalcBtn').addEventListener('click', () => {
    const finish = $('qFinish').value;
    const sqft = Number($('qSqft').value) || 450;
    const condition = $('qCondition').value;
    const baseRate = { solid: 4.5, flake: 6, metallic: 9, polyaspartic: 7.5 }[finish] || 6;
    let low = sqft * baseRate * 0.85;
    let high = sqft * baseRate * 1.25;
    if (condition === 'damaged') { low *= 1.15; high *= 1.3; }
    if (condition === 'coated') { low *= 1.2; high *= 1.4; }
    $('estPrice').textContent = `$${Math.round(low).toLocaleString()}–$${Math.round(high).toLocaleString()}`;
    $('estSummary').textContent = `Quick estimate for ${sqft} sq ft of ${finish} epoxy. Upload a photo above for a full AI-analyzed estimate.`;
    $('estResult').classList.add('show');
  });
}

/* ── Contact form ──────────────────────────────────────────────────── */
function initContactForm() {
  const form = $('demoContactForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.company_website) return; // honeypot — silently drop
    if (!data.name || !data.email) return;

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, email: data.email, zip: data.zip, message: `[demo-site lead] Phone: ${data.phone || 'n/a'}. ${data.message || ''}`, sourcePath: '/demo/' }),
    }).catch(() => { /* demo mode — still show success even if logging fails */ });

    form.hidden = true;
    $('contactSuccess').classList.add('show');
    setTimeout(() => toast('On your site this hits your inbox and CRM instantly.'), 600);
  });
}

/* ── Video modal ───────────────────────────────────────────────────── */
function initVideoModal() {
  $('videoSlot').addEventListener('click', () => $('videoModal').classList.add('open'));
  $('videoModalClose').addEventListener('click', () => $('videoModal').classList.remove('open'));
  $('videoModal').addEventListener('click', (e) => { if (e.target.id === 'videoModal') $('videoModal').classList.remove('open'); });
}

/* ── PageSpeed Insights live check ────────────────────────────────── */
function initPsiCheck() {
  $('psiCheckBtn').addEventListener('click', async () => {
    const status = $('psiStatus');
    status.textContent = 'Checking live scores… (~20-30s)';
    try {
      // Checks a real, indexed page (not /demo/ itself) — /demo/ is
      // intentionally noindexed as a fictional-business sample, and
      // Lighthouse's SEO category always flags noindex as a finding,
      // which would misleadingly tank this section's own pitch.
      const url = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=' + encodeURIComponent('https://www.epoxygrind.com/estimator/') + '&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo';
      const res = await fetch(url);
      if (!res.ok) throw new Error('PSI request failed');
      const data = await res.json();
      const cats = data.lighthouseResult?.categories;
      if (!cats) throw new Error('No categories returned');
      const rings = document.querySelectorAll('.score-ring');
      const order = ['performance', 'accessibility', 'best-practices', 'seo'];
      order.forEach((key, i) => {
        const score = Math.round((cats[key]?.score || 0) * 100);
        if (rings[i]) {
          rings[i].style.setProperty('--pct', score);
          rings[i].querySelector('span').textContent = score;
        }
      });
      status.textContent = 'Live scores loaded above.';
    } catch {
      status.textContent = 'Live check unavailable right now — use "Run the test yourself" instead.';
    }
  });
}

/* ── Reveal-on-scroll (shared observer for dynamically-added cards) ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('in'); revealObserver.unobserve(entry.target); } });
}, { threshold: 0.1 });

function init() {
  initTour();
  renderReviews();
  renderFaqs();
  loadGallery();
  initGallerySlider();
  initLightbox();
  initEstimator();
  initContactForm();
  initVideoModal();
  initPsiCheck();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
