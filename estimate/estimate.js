import {
  renderEstimate,
  loadEstimateSession,
} from '/calculator/estimate-view.js';

const id = new URLSearchParams(location.search).get('id');
const loading = document.getElementById('loadingState');
const error = document.getElementById('errorState');
const result = document.getElementById('resultPanel');
const doc = document.getElementById('estimateDoc');
const toastEl = document.getElementById('toast');

let currentEstimate = null;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function showEstimate(data) {
  currentEstimate = data;
  renderEstimate(doc, data);
  loading.hidden = true;
  error.hidden = true;
  result.hidden = false;
  document.title = `Estimate — ${data.customerName || data.projectName || 'Epoxy Grind'}`;
}

async function loadFromApi(estimateId) {
  const res = await fetch(`/api/estimates?id=${encodeURIComponent(estimateId)}`);
  if (!res.ok) return null;
  return res.json();
}

async function shareEstimate() {
  if (!currentEstimate || !id) return;
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast('Share link copied.');
  } catch {
    toast('Could not copy link.');
  }
}

function downloadEstimate() {
  if (!doc) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Epoxy floor estimate</title><link rel="stylesheet" href="${location.origin}/calculator/calculator.css"></head><body><main class="calc-page"><div class="wrap"><article class="estimate-doc">${doc.innerHTML}</article></div></main></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `estimate-${Date.now()}.html`;
  a.click();
}

async function loadEstimate() {
  if (id) {
    const apiData = await loadFromApi(id);
    if (apiData) {
      showEstimate(apiData);
      return;
    }

    const sessionData = loadEstimateSession(id);
    if (sessionData) {
      showEstimate(sessionData);
      return;
    }
  }

  loading.hidden = true;
  error.hidden = false;
}

document.getElementById('printEstimate')?.addEventListener('click', () => window.print());
document.getElementById('downloadEstimate')?.addEventListener('click', downloadEstimate);
document.getElementById('shareEstimate')?.addEventListener('click', shareEstimate);

loadEstimate();
