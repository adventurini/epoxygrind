const CIRCUMFERENCE = 2 * Math.PI * 28;

/**
 * Drives the circular percentage indicator rendered by
 * previewLoadingHtml() (calculator/estimate-view.js). Image generation has
 * no real incremental progress to report (one fal.ai call, done or not),
 * so this trickles toward 96% on an asymptotic curve — same approach as
 * the homepage's build progress bar — and snaps to 100% on finish().
 * @param {ParentNode} root - element containing the rendered previewLoadingHtml() markup
 */
export function createPreviewProgress(root) {
  if (!root) return { finish() {}, destroy() {} };

  const fill = root.querySelector('[data-preview-progress-fill]');
  const pctEl = root.querySelector('[data-preview-progress-pct]');
  if (!fill || !pctEl) return { finish() {}, destroy() {} };

  const startedAt = Date.now();
  let finished = false;
  let timer = null;

  function paint() {
    if (finished) return;
    const elapsed = (Date.now() - startedAt) / 1000;
    const pct = Math.min(96, Math.round(96 * (1 - Math.exp(-elapsed / 10))));
    fill.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - pct / 100));
    pctEl.textContent = `${pct}%`;
  }

  function finish() {
    finished = true;
    fill.style.strokeDashoffset = '0';
    pctEl.textContent = '100%';
    destroy();
  }

  function destroy() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  paint();
  timer = setInterval(paint, 200);

  return { finish, destroy };
}
