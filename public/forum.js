// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — FORUM.JS (formerly rules.js)
// The old rulebook content now lives as actual forum threads
// in the "Official Rules" category.
// ═══════════════════════════════════════════════════════════

injectNav('rules.html');

// ⚠️ Same Cloudinary setup as profile.js — fill these in once, they're shared in spirit
// (each file has its own copy since these are plain scripts, not modules).
const CLOUDINARY_CLOUD_NAME    = 'dbrsxel6l';
const CLOUDINARY_UPLOAD_PRESET = 'skycraper-duel-academy';

let myId = null;
let canModerate = false;
let currentCategoryId = null;
let currentThreadId = null;
let newThreadImageUrl = null;
let replyImageUrl = null;

async function uploadImageToCloudinary(file) {
  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    notify('⚠️ Image upload is not set up yet — ask the site owner to finish Cloudinary setup.');
    return null;
  }
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url || null;
  } catch {
    notify('⚠️ Image upload failed.');
    return null;
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function videoEmbedHtml(url) {
  if (!url) return '';
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return `<div style="margin-top:10px;"><iframe width="100%" height="220" style="border-radius:8px;border:none;"
      src="https://www.youtube.com/embed/${ytId}" allowfullscreen></iframe></div>`;
  }
  return `<div style="margin-top:10px;"><a href="${url}" target="_blank" rel="noopener" style="color:var(--gold);">🎬 Watch video ↗</a></div>`;
}

function escapeHtmlForum(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function hideAllViews() {
  ['view-categories', 'view-threads', 'view-new-thread', 'view-thread'].forEach(id => {
    document.getElementById(id).style.display = 'none';
  });
}

(async function init() {
  const res  = await fetch('/api/duelist-auth/check', { credentials: 'include' });
  const data = await res.json();
  if (data.loggedIn) myId = data.duelistId;
  canModerate = isAdminLoggedIn(); // covers Admin and Moderator, site-wide

  route();
})();

window.addEventListener('popstate', route);

function route() {
  const params = new URLSearchParams(window.location.search);
  const categoryId = params.get('category');
  const threadId   = params.get('thread');
  const isNew      = params.get('new');

  hideAllViews();
  if (threadId) {
    currentThreadId = threadId;
    loadThreadView(threadId);
  } else if (categoryId && isNew) {
    currentCategoryId = categoryId;
    document.getElementById('view-new-thread').style.display = 'block';
  } else if (categoryId) {
    currentCategoryId = categoryId;
    loadThreadListView(categoryId);
  } else {
    loadCategoriesView();
  }
}

// ── Category list ────────────────────────────────────────────
async function loadCategoriesView() {
  document.getElementById('view-categories').style.display = 'block';
  const res  = await fetch('/api/forum/categories');
  const data = await res.json();

  document.getElementById('cat-list').innerHTML = data.categories.map(c => `
    <a href="rules.html?category=${c.id}" class="card cat-card">
      <div class="cname">${c.icon} ${c.name}</div>
      <div class="cdesc">${c.description}</div>
      <div class="ccount">${c.threadCount} thread${c.threadCount === 1 ? '' : 's'}</div>
    </a>`).join('');
}

// ── Thread list (within a category) ─────────────────────────
async function loadThreadListView(categoryId) {
  document.getElementById('view-threads').style.display = 'block';
  const [catRes, threadsRes] = await Promise.all([
    fetch('/api/forum/categories').then(r => r.json()),
    fetch(`/api/forum/threads?categoryId=${categoryId}`).then(r => r.json()),
  ]);

  const cat = catRes.categories.find(c => c.id === categoryId);
  document.getElementById('thread-list-heading').textContent = cat ? `${cat.icon} ${cat.name}` : 'Threads';
  document.getElementById('new-thread-btn').style.display = myId ? 'inline-block' : 'none';
  document.getElementById('new-thread-btn').onclick = () => {
    window.location.href = `rules.html?category=${categoryId}&new=1`;
  };

  const threads = threadsRes.threads || [];
  document.getElementById('thread-list').innerHTML = threads.length
    ? threads.map(t => `
        <a href="rules.html?thread=${t.id}" class="card thread-row">
          <div class="ttitle">${t.pinned ? '📌 ' : ''}${escapeHtmlForum(t.title)} ${t.imageUrl ? '📷' : ''}${t.videoUrl ? '🎬' : ''}</div>
          <div class="tmeta">by ${t.authorName} · ${new Date(t.createdAt).toLocaleDateString()}</div>
        </a>`).join('')
    : `<p style="color:var(--muted);font-size:0.85rem;">No threads yet — be the first to post!</p>`;
}

// ── New thread form ──────────────────────────────────────────
window.handleNewThreadImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('new-thread-image-status').textContent = 'Uploading...';
  const url = await uploadImageToCloudinary(file);
  newThreadImageUrl = url;
  document.getElementById('new-thread-image-status').textContent = url ? '✅ Image attached' : '';
};

window.handleReplyImage = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('reply-image-status').textContent = 'Uploading...';
  const url = await uploadImageToCloudinary(file);
  replyImageUrl = url;
  document.getElementById('reply-image-status').textContent = url ? '✅ Image attached' : '';
};

window.cancelNewThread = function() {
  window.location.href = `rules.html?category=${currentCategoryId}`;
};

window.submitNewThread = async function() {
  const title = document.getElementById('new-thread-title').value.trim();
  const body  = document.getElementById('new-thread-body').value.trim();
  const errEl = document.getElementById('new-thread-err');
  errEl.style.display = 'none';

  if (!title || !body) {
    errEl.textContent = 'Title and body are both required.';
    errEl.style.display = 'block';
    return;
  }

  const res  = await fetch('/api/forum/threads', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({
      categoryId: currentCategoryId, title, body,
      imageUrl: newThreadImageUrl,
      videoUrl: document.getElementById('new-thread-video-url').value.trim() || null,
    }),
  });
  const data = await res.json();

  if (!data.success) {
    errEl.textContent = data.message || 'Could not post thread.';
    errEl.style.display = 'block';
    return;
  }

  window.location.href = `rules.html?thread=${data.thread.id}`;
};

// ── Thread detail ────────────────────────────────────────────
async function loadThreadView(threadId) {
  document.getElementById('view-thread').style.display = 'block';
  const res  = await fetch(`/api/forum/threads/${threadId}`);
  if (!res.ok) {
    document.getElementById('thread-title').textContent = 'Thread not found';
    return;
  }
  const data = await res.json();
  const t = data.thread;
  currentCategoryId = t.categoryId;

  const catRes = await fetch('/api/forum/categories').then(r => r.json());
  const cat = catRes.categories.find(c => c.id === t.categoryId);
  document.getElementById('thread-breadcrumb').innerHTML =
    `<a href="rules.html">← All Boards</a> / <a href="rules.html?category=${t.categoryId}">${cat ? cat.name : t.categoryId}</a>`;

  document.getElementById('thread-title').textContent = (t.pinned ? '📌 ' : '') + t.title;
  document.getElementById('thread-meta').innerHTML = `by <a href="profile.html?id=${t.authorId}" style="color:var(--gold);text-decoration:none;">${t.authorName}</a> · ${new Date(t.createdAt).toLocaleString()}`;
  document.getElementById('thread-body').textContent = t.body;
  document.getElementById('thread-media').innerHTML =
    (t.imageUrl ? `<img src="${t.imageUrl}" style="max-width:100%;border-radius:8px;margin-top:10px;display:block;"/>` : '') +
    videoEmbedHtml(t.videoUrl);

  const canDeleteThread = myId && (t.authorId === myId || canModerate);
  document.getElementById('thread-actions').style.display = canDeleteThread ? 'block' : 'none';
  document.getElementById('pin-btn').style.display = canModerate ? 'inline-block' : 'none';

  const replies = data.replies || [];
  document.getElementById('reply-count-heading').textContent = `${replies.length} Repl${replies.length === 1 ? 'y' : 'ies'}`;
  document.getElementById('reply-list').innerHTML = replies.map(r => {
    const canDeleteReply = myId && (r.authorId === myId || canModerate);
    return `
      <div class="card reply-card">
        <div class="reply-who"><a href="profile.html?id=${r.authorId}" style="color:inherit;">${r.authorName}</a><span class="reply-when">${new Date(r.createdAt).toLocaleString()}</span></div>
        <div class="reply-text">${escapeHtmlForum(r.text)}</div>
        ${r.imageUrl ? `<img src="${r.imageUrl}" style="max-width:100%;border-radius:8px;margin-top:8px;display:block;"/>` : ''}
        ${videoEmbedHtml(r.videoUrl)}
        ${canDeleteReply ? `<button class="btn-icon" style="font-size:0.68rem;color:var(--sl);margin-top:6px;" onclick="deleteReply('${r.id}')">Delete</button>` : ''}
      </div>`;
  }).join('') || `<p style="color:var(--muted);font-size:0.85rem;">No replies yet.</p>`;

  document.getElementById('reply-form-wrap').style.display = myId ? 'block' : 'none';
  document.getElementById('reply-signed-out').style.display = myId ? 'none' : 'block';
}

window.submitReply = async function() {
  const input = document.getElementById('reply-input');
  const text  = input.value.trim();
  const videoUrl = document.getElementById('reply-video-url').value.trim() || null;
  if (!text && !replyImageUrl) return;

  const res  = await fetch(`/api/forum/threads/${currentThreadId}/replies`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ text, imageUrl: replyImageUrl, videoUrl }),
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not post reply'}`); return; }

  input.value = '';
  document.getElementById('reply-video-url').value = '';
  document.getElementById('reply-image-status').textContent = '';
  replyImageUrl = null;
  loadThreadView(currentThreadId);
};

window.deleteReply = async function(replyId) {
  if (!confirm('Delete this reply?')) return;
  const res  = await fetch(`/api/forum/threads/${currentThreadId}/replies/${replyId}`, {
    method: 'DELETE', credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not delete'}`); return; }
  loadThreadView(currentThreadId);
};

window.deleteThread = async function() {
  if (!confirm('Delete this entire thread and all its replies?')) return;
  const res  = await fetch(`/api/forum/threads/${currentThreadId}`, {
    method: 'DELETE', credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not delete'}`); return; }
  window.location.href = `rules.html?category=${currentCategoryId}`;
};

window.togglePin = async function() {
  const res  = await fetch(`/api/forum/threads/${currentThreadId}/pin`, {
    method: 'POST', credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) { notify(`⚠️ ${data.message || 'Could not update'}`); return; }
  notify(data.pinned ? '📌 Pinned' : 'Unpinned');
  loadThreadView(currentThreadId);
};

window.openNewThread = function() {
  window.location.href = `rules.html?category=${currentCategoryId}&new=1`;
};