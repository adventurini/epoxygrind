const BUILD_STEPS = [
  { id: 'build', label: 'Analyzing photo & pricing' },
  { id: 'previews', label: 'Generating floor previews' },
  { id: 'load', label: 'Opening your results' },
];

function formatElapsed(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export function createEstimateProgress(root) {
  if (!root) {
    return { setPhase() {}, completePhase() {}, finish() {}, destroy() {} };
  }

  const fill = root.querySelector('#progressFill');
  const percentEl = root.querySelector('#progressPercent');
  const metaEl = root.querySelector('#progressRemaining');
  const stepEl = root.querySelector('#progressStep') || root.querySelector('#loadMsg');
  const track = root.querySelector('.estimate-progress-track');

  const startedAt = Date.now();
  let completedSteps = 0;
  let activeStep = 0;
  let stepStartedAt = Date.now();
  let timer = null;
  let finished = false;

  function paint() {
    if (finished) return;

    const total = BUILD_STEPS.length;
    // Trickle the in-progress step's share up over time instead of a fixed
    // bump, so the bar keeps creeping during long waits (e.g. slow preview
    // generation) rather than parking at the same percent for minutes.
    const elapsedInStep = (Date.now() - stepStartedAt) / 1000;
    const trickle = completedSteps < total ? Math.min(0.9, 1 - Math.exp(-elapsedInStep / 15)) : 0;
    const pct = Math.min(
      99,
      Math.round(((completedSteps + trickle) / total) * 100),
    );
    const step = BUILD_STEPS[activeStep] || BUILD_STEPS[total - 1];

    if (fill) fill.style.width = `${pct}%`;
    if (percentEl) percentEl.textContent = `${pct}%`;
    if (metaEl) metaEl.textContent = `Step ${Math.min(activeStep + 1, total)} of ${total} · ${formatElapsed(Date.now() - startedAt)}`;
    if (stepEl) stepEl.textContent = step.label;
    if (track) {
      track.setAttribute('aria-valuenow', String(pct));
      track.setAttribute('aria-valuetext', `${pct}% — ${step.label}`);
    }
  }

  function setPhase(id, label) {
    const idx = BUILD_STEPS.findIndex((step) => step.id === id);
    if (idx >= 0 && idx !== activeStep) {
      activeStep = idx;
      stepStartedAt = Date.now();
    }
    if (label && stepEl) stepEl.textContent = label;
    paint();
  }

  function completePhase(id) {
    const idx = BUILD_STEPS.findIndex((step) => step.id === id);
    if (idx < 0) return;
    completedSteps = Math.max(completedSteps, idx + 1);
    activeStep = Math.min(idx + 1, BUILD_STEPS.length - 1);
    stepStartedAt = Date.now();
    paint();
  }

  function finish() {
    finished = true;
    completedSteps = BUILD_STEPS.length;
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

  setPhase(BUILD_STEPS[0].id);
  timer = setInterval(paint, 500);

  return { setPhase, completePhase, finish, destroy };
}
