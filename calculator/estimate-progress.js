function formatElapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

/**
 * Single-phase progress: photo analysis + pricing + save. Image generation
 * happens afterward, in the background, with its own spinner on the preview
 * card — it's no longer part of this bar.
 */
export function createEstimateProgress(root) {
  if (!root) {
    return { setPhase() {}, finish() {}, destroy() {} };
  }

  const fill = root.querySelector('#progressFill');
  const percentEl = root.querySelector('#progressPercent');
  const metaEl = root.querySelector('#progressRemaining');
  const stepEl = root.querySelector('#progressStep') || root.querySelector('#loadMsg');
  const track = root.querySelector('.estimate-progress-track');

  const startedAt = Date.now();
  let timer = null;
  let finished = false;

  function paint() {
    if (finished) return;

    const elapsed = (Date.now() - startedAt) / 1000;
    // Asymptotic curve toward 99% — always visibly moving, never claims done
    // before finish() is actually called.
    const pct = Math.min(99, Math.round(97 * (1 - Math.exp(-elapsed / 12))));

    if (fill) fill.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (metaEl) metaEl.textContent = formatElapsed(Date.now() - startedAt);
    if (track) {
      track.setAttribute('aria-valuenow', String(pct));
      track.setAttribute('aria-valuetext', `${pct}%`);
    }
  }

  function setPhase(_id, label) {
    if (label && stepEl) stepEl.textContent = label;
  }

  function finish() {
    finished = true;
    if (fill) fill.style.width = '100%';
    if (percentEl) percentEl.textContent = '100%';
    if (metaEl) metaEl.textContent = `Done · ${formatElapsed(Date.now() - startedAt)}`;
    if (stepEl) stepEl.textContent = 'Your estimate is ready.';
    if (track) track.setAttribute('aria-valuenow', '100');
    destroy();
  }

  function destroy() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  paint();
  timer = setInterval(paint, 250);

  return { setPhase, finish, destroy };
}
