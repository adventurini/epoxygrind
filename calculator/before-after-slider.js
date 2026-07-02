import { track } from './analytics.js';

const SWEEP_SESSION_KEY = 'epoxygrind-ba-swept';

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

/**
 * Self-contained before/after drag slider. No external dependencies.
 * @param {HTMLElement} root - the `.ba-slider` element (role="slider")
 */
export function initBeforeAfterSlider(root) {
  if (!root) return;

  const frame = root.querySelector('.ba-slider-frame');
  const afterWrap = root.querySelector('.ba-after-wrap');
  const divider = root.querySelector('.ba-divider');
  if (!frame || !afterWrap || !divider) return;

  let pct = 50;
  let dragging = false;
  let trackedInteraction = false;

  function setPct(next, { silent = false } = {}) {
    pct = Math.min(100, Math.max(0, next));
    afterWrap.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    divider.style.left = `${pct}%`;
    root.setAttribute('aria-valuenow', String(Math.round(pct)));
    if (!silent && !trackedInteraction) {
      trackedInteraction = true;
      track('slider_interacted', { pct: Math.round(pct) });
    }
  }

  function pctFromClientX(clientX) {
    const rect = frame.getBoundingClientRect();
    if (!rect.width) return pct;
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function onPointerDown(e) {
    dragging = true;
    frame.setPointerCapture(e.pointerId);
    setPct(pctFromClientX(e.clientX));
  }
  function onPointerMove(e) {
    if (!dragging) return;
    setPct(pctFromClientX(e.clientX));
  }
  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try { frame.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }

  frame.addEventListener('pointerdown', onPointerDown);
  frame.addEventListener('pointermove', onPointerMove);
  frame.addEventListener('pointerup', onPointerUp);
  frame.addEventListener('pointercancel', onPointerUp);

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      setPct(pct - 5);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      setPct(pct + 5);
      e.preventDefault();
    }
  });

  setPct(50, { silent: true });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || sessionStorage.getItem(SWEEP_SESSION_KEY)) return;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      sessionStorage.setItem(SWEEP_SESSION_KEY, '1');
      io.disconnect();
      autoSweep();
    }
  }, { threshold: 0.5 });
  io.observe(root);

  function autoSweep() {
    const keyframes = [
      { t: 0, pct: 20 },
      { t: 800, pct: 65 },
      { t: 1600, pct: 45 },
    ];
    const start = performance.now();
    const total = keyframes[keyframes.length - 1].t;

    function step(now) {
      const elapsed = now - start;
      if (elapsed >= total) {
        setPct(keyframes[keyframes.length - 1].pct, { silent: true });
        return;
      }
      let seg = keyframes[0];
      let next = keyframes[1];
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (elapsed >= keyframes[i].t && elapsed <= keyframes[i + 1].t) {
          seg = keyframes[i];
          next = keyframes[i + 1];
          break;
        }
      }
      const segT = (elapsed - seg.t) / (next.t - seg.t);
      const value = seg.pct + (next.pct - seg.pct) * easeInOutQuad(segT);
      setPct(value, { silent: true });
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
}
