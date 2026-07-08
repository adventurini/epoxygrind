import { initDashboard } from '/app/shell.js';
import { authFetch, getAuthClient } from '/auth/client.js';

const deniedEl = document.getElementById('responderDenied');
const bodyEl = document.getElementById('responderBody');
const toastEl = document.getElementById('toast');

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.hidden = true; }, 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let conversations = [];
let currentConversationId = null;

async function loadConversations() {
  const loading = document.getElementById('respListLoading');
  const empty = document.getElementById('respListEmpty');
  const items = document.getElementById('respListItems');
  try {
    const res = await authFetch('/api/admin/responder/conversations');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load conversations.');
    conversations = data.conversations;
    loading.hidden = true;
    empty.hidden = conversations.length > 0;
    renderList();
  } catch (err) {
    loading.textContent = err.message || 'Could not load conversations.';
  }
}

function renderList() {
  const items = document.getElementById('respListItems');
  items.innerHTML = conversations.map((c) => {
    const name = c.contact?.name || c.contact?.phone || 'Unknown';
    const time = c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    return `<div class="resp-item ${c.id === currentConversationId ? 'is-active' : ''}" data-id="${c.id}">
      <div class="resp-item-top"><span class="resp-item-name">${escapeHtml(name)}</span><span class="resp-item-time">${time}</span></div>
      <span class="resp-status-pill ${c.status}">${c.status.replace('_', ' ')}</span>
    </div>`;
  }).join('');
}

document.getElementById('respListItems').addEventListener('click', (ev) => {
  const item = ev.target.closest('.resp-item[data-id]');
  if (item) openConversation(item.dataset.id);
});

async function openConversation(id) {
  currentConversationId = id;
  renderList();
  document.getElementById('respThreadEmpty').hidden = true;
  document.getElementById('respThreadContent').hidden = false;

  const conv = conversations.find((c) => c.id === id);
  document.getElementById('respThreadName').textContent = conv?.contact?.name || conv?.contact?.phone || 'Unknown';
  document.getElementById('respThreadMeta').textContent = `${conv?.contact?.phone || ''} · ${conv?.channel || ''}`;

  try {
    const res = await authFetch(`/api/admin/responder/messages?conversationId=${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load messages.');
    renderMessages(data.messages);
  } catch (err) {
    toast(err.message || 'Could not load messages.');
  }
}

function renderMessages(messages) {
  const el = document.getElementById('respMessages');
  el.innerHTML = messages.map((m) => `
    <div class="resp-message dir-${m.direction}">
      <div>${escapeHtml(m.body)}</div>
      <div class="resp-message-meta">${m.sender_type} · ${new Date(m.created_at).toLocaleString()}</div>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}

document.getElementById('respSendBtn').addEventListener('click', async () => {
  const textarea = document.getElementById('respReplyText');
  const body = textarea.value.trim();
  if (!body || !currentConversationId) return;
  const btn = document.getElementById('respSendBtn');
  btn.disabled = true;
  try {
    const res = await authFetch('/api/admin/responder/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: currentConversationId, body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed.');
    textarea.value = '';
    await openConversation(currentConversationId);
    await loadConversations();
  } catch (err) {
    toast(err.message || 'Send failed.');
  } finally {
    btn.disabled = false;
  }
});

async function boot() {
  const user = await initDashboard({ activeNav: 'admin' });
  if (!user) return;

  let isAdmin = false;
  try {
    const supabase = await getAuthClient();
    const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle();
    isAdmin = data?.is_admin === true;
  } catch {
    isAdmin = false;
  }

  if (!isAdmin) {
    deniedEl.hidden = false;
    return;
  }

  bodyEl.hidden = false;
  await loadConversations();
}

boot().catch((err) => toast(err.message || 'Failed to load responder page.'));
