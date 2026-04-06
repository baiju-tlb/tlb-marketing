// ==================== STATE ====================
let currentPage = 'dashboard';
let currentPostFilter = '';
let selectedArticleId = null;
let editingPostId = null;
let previewPostContent = '';

const API = '';

// ==================== NAVIGATION ====================
function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(`page-${page}`).classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('text-brand-600', 'bg-brand-50', 'font-medium');
    link.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');
  });
  const activeLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (activeLink) {
    activeLink.classList.add('text-brand-600', 'bg-brand-50', 'font-medium');
    activeLink.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');
  }

  // Load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'news') loadArticles();
  if (page === 'posts') loadPosts();
  if (page === 'write-article') loadLinkedinArticles();
  if (page === 'calendar') loadCalendar();
  if (page === 'settings') loadSettings();

  lucide.createIcons();
}

// ==================== TOAST ====================
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const colors = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700'
  };
  toast.className = `fixed bottom-6 right-6 z-50 toast-enter px-4 py-3 rounded-xl border text-sm font-medium shadow-lg ${colors[type] || colors.info}`;
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ==================== API HELPERS ====================
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return res.json();
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
  const stats = await api('/api/stats');
  document.getElementById('stat-new-articles').textContent = stats.newArticles || 0;
  document.getElementById('stat-drafts').textContent = stats.drafts || 0;
  document.getElementById('stat-approved').textContent = stats.approved || 0;
  document.getElementById('stat-published').textContent = stats.published || 0;

  // Update nav badges
  updateBadge('nav-news-badge', stats.newArticles);
  updateBadge('nav-posts-badge', stats.drafts);
  updateBadge('nav-articles-badge', stats.draftLinkedinArticles);

  // Update sidebar user
  updateSidebarUser();

  // Load recent articles
  const { articles } = await api('/api/articles?limit=5&status=new');
  renderRecentArticles(articles);

  // Load recent posts
  const { posts } = await api('/api/posts?limit=5&status=draft');
  renderRecentPosts(posts);

  lucide.createIcons();
}

function updateBadge(id, count) {
  const badge = document.getElementById(id);
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderRecentArticles(articles) {
  const container = document.getElementById('recent-articles');
  if (!articles.length) {
    container.innerHTML = '<div class="p-6 text-center text-sm text-gray-400">No new articles. Click "Fetch News".</div>';
    return;
  }
  container.innerHTML = articles.map(a => `
    <div class="px-5 py-3 flex items-center gap-3">
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${regionClass(a.region)}">${a.region}</span>
      <p class="text-sm text-gray-700 truncate flex-1">${escHtml(a.title)}</p>
      <button onclick="openGenerateModal(${a.id}, '${escHtml(a.title)}')" class="text-brand-600 hover:text-brand-700 flex-shrink-0">
        <i data-lucide="sparkles" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');
}

function renderRecentPosts(posts) {
  const container = document.getElementById('recent-posts');
  if (!posts.length) {
    container.innerHTML = '<div class="p-6 text-center text-sm text-gray-400">No drafts yet.</div>';
    return;
  }
  container.innerHTML = posts.map(p => `
    <div class="px-5 py-3 flex items-center gap-3">
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(p.status)}">${p.status}</span>
      <p class="text-sm text-gray-700 truncate flex-1">${escHtml(p.content.substring(0, 80))}...</p>
      <button onclick="openPreview(${p.id})" class="text-gray-400 hover:text-gray-600 flex-shrink-0">
        <i data-lucide="eye" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');
}

// ==================== NEWS FEED ====================
async function loadArticles() {
  const region = document.getElementById('filter-region')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';
  const params = new URLSearchParams();
  if (region) params.set('region', region);
  if (status) params.set('status', status);
  params.set('limit', '50');

  const { articles } = await api(`/api/articles?${params}`);
  renderArticles(articles);
  lucide.createIcons();
}

function renderArticles(articles) {
  const container = document.getElementById('articles-list');
  if (!articles.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">No articles found.</div>';
    return;
  }

  container.innerHTML = articles.map(a => `
    <div class="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-start gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${regionClass(a.region)}">${a.region}</span>
          <span class="text-xs text-gray-400">${a.source || ''}</span>
          <span class="text-xs text-gray-300">${timeAgo(a.published_at)}</span>
        </div>
        <h4 class="text-sm font-medium text-gray-800 leading-snug">${escHtml(a.title)}</h4>
        ${a.summary ? `<p class="text-xs text-gray-400 mt-1 line-clamp-2">${escHtml(a.summary.substring(0, 150))}</p>` : ''}
      </div>
      <div class="flex gap-2 flex-shrink-0">
        ${a.status === 'new' ? `
          <button onclick="openGenerateModal(${a.id}, '${escAttr(a.title)}')" class="flex items-center gap-1.5 bg-brand-50 text-brand-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-brand-100 transition">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Post
          </button>
          <button onclick="quickGenerateArticle(${a.id})" class="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Article
          </button>
          <button onclick="skipArticle(${a.id})" class="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        ` : `
          <span class="text-xs text-gray-400 px-2 py-1.5">${a.status}</span>
        `}
      </div>
    </div>
  `).join('');
}

async function skipArticle(id) {
  await api(`/api/articles/${id}`, { method: 'PATCH', body: { status: 'skipped' } });
  loadArticles();
  showToast('Article skipped', 'info');
}

// ==================== GENERATE MODAL ====================
function openGenerateModal(articleId, title) {
  selectedArticleId = articleId;
  document.getElementById('modal-article-preview').textContent = title;
  document.getElementById('modal-generate').classList.remove('hidden');
  lucide.createIcons();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

async function generatePostFromModal() {
  const btn = document.getElementById('btn-generate-post');
  const postType = document.getElementById('modal-post-type').value;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';

  try {
    const result = await api('/api/posts/generate', {
      method: 'POST',
      body: { articleId: selectedArticleId, postType }
    });

    if (result.error) throw new Error(result.error);

    closeModal('modal-generate');
    showToast('Post generated successfully!');
    loadDashboard();
    loadArticles();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> Generate';
    lucide.createIcons();
  }
}

// ==================== POSTS ====================
async function loadPosts() {
  const params = currentPostFilter ? `?status=${currentPostFilter}` : '';
  const { posts } = await api(`/api/posts${params}`);
  renderPosts(posts);
  lucide.createIcons();
}

function filterPosts(status) {
  currentPostFilter = status;
  document.querySelectorAll('.post-tab').forEach(tab => {
    if (tab.dataset.status === status) {
      tab.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
      tab.classList.remove('text-gray-500');
    } else {
      tab.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
      tab.classList.add('text-gray-500');
    }
  });
  loadPosts();
}

function renderPosts(posts) {
  const container = document.getElementById('posts-list');
  if (!posts.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">No posts found.</div>';
    return;
  }

  container.innerHTML = posts.map(p => `
    <div class="bg-white rounded-xl border border-gray-100 p-5">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(p.status)}">${p.status}</span>
          <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">${p.post_type?.replace('_', ' ') || ''}</span>
          ${p.region ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${regionClass(p.region)}">${p.region}</span>` : ''}
        </div>
        <span class="text-xs text-gray-400">${timeAgo(p.created_at)}</span>
      </div>
      ${p.article_title ? `<p class="text-xs text-gray-400 mb-2">Based on: ${escHtml(p.article_title)}</p>` : ''}
      ${p.image_url ? `
      <img src="${p.image_url}" class="rounded-lg h-32 object-cover mb-3" />
      ` : ''}
      <div class="bg-gray-50 rounded-lg p-4 mb-3 text-sm text-gray-700 leading-relaxed post-content-text max-h-48 overflow-y-auto">${escHtml(p.content)}</div>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex gap-2">
          <button onclick="openPreview(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
          </button>
          <button onclick="openEditModal(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit
          </button>
          <button onclick="copyPost(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200" id="btn-copy-${p.id}">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          <button onclick="regeneratePost(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Regenerate
          </button>
          ${!p.image_url ? `
          <button onclick="generateImage(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="image" class="w-3.5 h-3.5"></i> Gen Image
          </button>
          ` : `
          <button onclick="generateImage(${p.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="image" class="w-3.5 h-3.5"></i> New Image
          </button>
          <button onclick="deletePostImage(${p.id})" class="flex items-center gap-1.5 text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50 transition border border-gray-200">
            <i data-lucide="image-off" class="w-3.5 h-3.5"></i> Remove Image
          </button>
          `}
        </div>
        <div class="flex gap-2">
          ${p.status === 'draft' ? `
            <button onclick="approvePost(${p.id})" class="flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
            </button>
          ` : ''}
          ${p.status === 'approved' ? `
            <button onclick="openScheduleModal(${p.id})" class="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-100 transition">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i> Schedule
            </button>
            <button onclick="publishNow(${p.id})" id="btn-publish-${p.id}" class="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
              <i data-lucide="send" class="w-3.5 h-3.5"></i> Publish Now
            </button>
          ` : ''}
          ${p.status === 'scheduled' ? `
            <span class="text-xs text-amber-600 flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${formatScheduleDate(p.scheduled_at)}
            </span>
            <button onclick="cancelSchedule(${p.id})" class="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition">
              Cancel
            </button>
          ` : ''}
          ${p.status === 'published' ? `
            <span class="text-xs text-green-600 flex items-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Published ${timeAgo(p.published_at)}
            </span>
            <a href="https://www.linkedin.com/company/112976963/admin/feed/" target="_blank" class="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
              <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Reshare to Company Page
            </a>
          ` : ''}
          ${p.status === 'failed' ? `
            <span class="text-xs text-red-500 flex items-center gap-1">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Failed
            </span>
            <button onclick="approvePost(${p.id})" class="text-xs text-brand-600 hover:underline">Retry</button>
          ` : ''}
          <button onclick="deletePost(${p.id})" class="flex items-center gap-1.5 text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg text-xs hover:bg-red-50 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== POST ACTIONS ====================
async function approvePost(id) {
  await api(`/api/posts/${id}`, { method: 'PATCH', body: { status: 'approved' } });
  showToast('Post approved!');
  loadPosts();
  loadDashboard();
}

// ==================== SCHEDULE & PUBLISH ====================
let schedulingPostId = null;

function openScheduleModal(id) {
  schedulingPostId = id;
  // Default to tomorrow 9 AM IST
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  document.getElementById('schedule-datetime').value = formatLocalDatetime(tomorrow);
  document.getElementById('modal-schedule').classList.remove('hidden');
  lucide.createIcons();
}

async function confirmSchedule() {
  const datetime = document.getElementById('schedule-datetime').value;
  if (!datetime) { showToast('Please select a date and time', 'error'); return; }

  const scheduledAt = new Date(datetime).toISOString();

  try {
    await api(`/api/posts/${schedulingPostId}/schedule`, {
      method: 'POST',
      body: { scheduled_at: scheduledAt }
    });
    closeModal('modal-schedule');
    showToast('Post scheduled!');
    loadPosts();
    loadDashboard();
  } catch (err) {
    showToast('Failed to schedule', 'error');
  }
}

async function cancelSchedule(id) {
  await api(`/api/posts/${id}`, { method: 'PATCH', body: { status: 'approved' } });
  showToast('Schedule cancelled');
  loadPosts();
}

async function publishNow(id) {
  const btn = document.getElementById(`btn-publish-${id}`);
  if (btn) btn.innerHTML = '<span class="spinner"></span> Publishing...';

  try {
    const result = await api(`/api/posts/${id}/publish`, { method: 'POST', body: {} });
    if (result.error) throw new Error(result.error);
    showToast('Published to LinkedIn!');
    loadPosts();
    loadDashboard();
  } catch (err) {
    showToast(err.message || 'Failed to publish', 'error');
    if (btn) {
      btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i> Publish Now';
      lucide.createIcons();
    }
  }
}

function formatScheduleDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatLocalDatetime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  await api(`/api/posts/${id}`, { method: 'DELETE' });
  showToast('Post deleted', 'info');
  loadPosts();
}

async function regeneratePost(id) {
  const btn = document.querySelector(`#posts-list [onclick="regeneratePost(${id})"]`);
  if (btn) btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api(`/api/posts/${id}/regenerate`, { method: 'POST', body: {} });
    showToast('Post regenerated!');
    loadPosts();
  } catch (err) {
    showToast('Failed to regenerate', 'error');
  }
}

let imageGenPostId = null;
let selectedImageStyle = 'photorealistic';

const IMAGE_STYLE_PROMPTS = {
  photorealistic: 'Photorealistic, high-resolution photograph style, natural lighting, realistic textures and details.',
  illustration: 'Digital illustration style, clean lines, vibrant colors, detailed artistic rendering.',
  cartoon: 'Cartoon style, bold outlines, bright saturated colors, playful and friendly look, stylized characters and objects.',
  '3d_render': '3D rendered style, smooth surfaces, realistic lighting and shadows, depth of field, cinematic 3D visualization.',
  flat_design: 'Flat design style, simple geometric shapes, bold solid colors, no shadows or gradients, modern and clean.',
  watercolor: 'Watercolor painting style, soft flowing colors, gentle brush strokes, artistic and elegant, paper texture.',
  infographic: 'Infographic style, clean data visualization, icons and symbols, structured layout, professional business graphics.',
  minimalist: 'Minimalist style, simple composition, lots of white space, limited color palette, elegant and understated.',
  isometric: 'Isometric 3D style, geometric precision, 30-degree angle view, clean technical illustration, modern tech look.'
};

function selectImageStyle(style) {
  selectedImageStyle = style;
  document.querySelectorAll('.img-style-btn').forEach(btn => {
    if (btn.dataset.style === style) {
      btn.classList.add('border-brand-500', 'bg-brand-50');
      btn.classList.remove('border-gray-200');
    } else {
      btn.classList.remove('border-brand-500', 'bg-brand-50');
      btn.classList.add('border-gray-200');
    }
  });
}

async function generateImage(id) {
  imageGenPostId = id;
  selectedImageStyle = 'photorealistic';
  // Fetch the post to get its image prompt
  const { posts } = await api('/api/posts?limit=100');
  const post = posts.find(p => p.id === id);
  if (!post) return;

  document.getElementById('image-gen-prompt').value = post.image_prompt || '';
  document.getElementById('image-gen-preview').classList.add('hidden');
  // Reset style selection
  selectImageStyle('photorealistic');
  document.getElementById('modal-image').classList.remove('hidden');
  lucide.createIcons();
}

async function confirmImageGen() {
  const prompt = document.getElementById('image-gen-prompt').value.trim();
  if (!prompt) { showToast('Please enter an image prompt', 'error'); return; }

  const btn = document.getElementById('btn-image-gen-confirm');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75"></path></svg> Generating...';

  try {
    const stylePrompt = IMAGE_STYLE_PROMPTS[selectedImageStyle] || '';
    const fullPrompt = stylePrompt ? `${stylePrompt} ${prompt}` : prompt;
    const result = await api(`/api/posts/${imageGenPostId}/generate-image`, {
      method: 'POST',
      body: { imagePrompt: fullPrompt }
    });

    if (result.imageUrl) {
      // Show preview in modal
      document.getElementById('image-gen-preview-img').src = result.imageUrl;
      document.getElementById('image-gen-preview').classList.remove('hidden');
      showToast('Image generated!');

      // Update button to "Done"
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Done';
      btn.onclick = function() { closeModal('modal-image'); loadPosts(); btn.onclick = confirmImageGen; };
      lucide.createIcons();
      return;
    } else {
      showToast('Image generation failed', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Image generation failed', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="image" class="w-4 h-4"></i> Generate Image';
  lucide.createIcons();
}

async function deletePostImage(id) {
  if (!confirm('Remove the image from this post?')) return;
  await api(`/api/posts/${id}`, { method: 'PATCH', body: { image_url: '', image_prompt: '' } });
  showToast('Image removed', 'info');
  loadPosts();
}

async function copyPost(id) {
  const { posts } = await api(`/api/posts?limit=100`);
  const post = posts.find(p => p.id === id);
  if (!post) return;
  try {
    await navigator.clipboard.writeText(post.content);
    const btn = document.getElementById(`btn-copy-${id}`);
    if (btn) {
      btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied!';
      btn.classList.add('text-green-600', 'border-green-200', 'bg-green-50');
      lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy';
        btn.classList.remove('text-green-600', 'border-green-200', 'bg-green-50');
        lucide.createIcons();
      }, 2000);
    }
  } catch {
    showToast('Failed to copy', 'error');
  }
}

// ==================== EDIT MODAL ====================
async function openEditModal(id) {
  editingPostId = id;
  const { posts } = await api(`/api/posts?limit=100`);
  const post = posts.find(p => p.id === id);
  if (!post) return;
  document.getElementById('edit-content').value = post.content;
  document.getElementById('edit-image-prompt').value = post.image_prompt || '';
  document.getElementById('modal-edit').classList.remove('hidden');
  lucide.createIcons();
}

async function savePostEdit() {
  const content = document.getElementById('edit-content').value;
  const imagePrompt = document.getElementById('edit-image-prompt').value;
  await api(`/api/posts/${editingPostId}`, { method: 'PATCH', body: { content, image_prompt: imagePrompt } });
  closeModal('modal-edit');
  showToast('Post updated!');
  loadPosts();
}

// ==================== PREVIEW ====================
async function openPreview(id) {
  const { posts } = await api(`/api/posts?limit=100`);
  const post = posts.find(p => p.id === id);
  if (!post) return;
  previewPostContent = post.content;
  document.getElementById('preview-content').textContent = post.content;

  const imgContainer = document.getElementById('preview-image-container');
  if (post.image_url) {
    document.getElementById('preview-image').src = post.image_url;
    imgContainer.classList.remove('hidden');
  } else {
    imgContainer.classList.add('hidden');
  }

  document.getElementById('modal-preview').classList.remove('hidden');
  lucide.createIcons();
}

async function copyPreviewContent() {
  try {
    await navigator.clipboard.writeText(previewPostContent);
    const btn = document.getElementById('btn-copy-preview');
    btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Copied!';
    btn.classList.add('bg-green-600');
    btn.classList.remove('bg-gray-800');
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i> Copy to Clipboard';
      btn.classList.remove('bg-green-600');
      btn.classList.add('bg-gray-800');
      lucide.createIcons();
    }, 2000);
  } catch {
    showToast('Failed to copy', 'error');
  }
}

// ==================== SCRAPE ====================
async function scrapeNews() {
  const btn = document.getElementById('btn-scrape');
  const btnNews = document.querySelector('#page-news .flex button');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75"></path></svg> Fetching news...';
    btn.classList.add('opacity-75', 'cursor-not-allowed');
  }
  if (btnNews && btnNews !== btn) {
    btnNews.disabled = true;
    btnNews.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75"></path></svg> Fetching news...';
    btnNews.classList.add('opacity-75', 'cursor-not-allowed');
  }
  try {
    const result = await api('/api/articles/scrape', { method: 'POST' });
    showToast(`Fetched ${result.newArticles || 0} new articles!`);
    loadDashboard();
    if (currentPage === 'news') loadArticles();
  } catch (err) {
    showToast('Failed to fetch news', 'error');
  } finally {
    [btn, btnNews].forEach(b => {
      if (b) {
        b.disabled = false;
        b.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Fetch News';
        b.classList.remove('opacity-75', 'cursor-not-allowed');
      }
    });
    lucide.createIcons();
  }
}

// ==================== SETTINGS ====================
async function loadSettings() {
  const settings = await api('/api/settings');
  const freq = document.getElementById('setting-frequency');
  const tone = document.getElementById('setting-tone');
  if (freq && settings.post_frequency) freq.value = settings.post_frequency;
  if (tone && settings.tone) tone.value = settings.tone;

  // Load LinkedIn status
  loadLinkedInStatus();
}

async function loadLinkedInStatus() {
  const status = await api('/api/linkedin/status');
  const container = document.getElementById('linkedin-status');
  if (!container) return;

  const postingBadge = status.hasOrgAccess
    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium"><i data-lucide="building-2" class="w-3 h-3"></i> Company Page</span>'
    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium"><i data-lucide="user" class="w-3 h-3"></i> Personal Profile</span>';

  if (status.connected && status.users.length > 0) {
    const usersHtml = status.users.map(u => {
      const isExpired = u.expires && new Date(u.expires) < new Date();
      const initial = (u.name || '?')[0].toUpperCase();
      return `
        <div class="flex items-center gap-3 p-3 rounded-lg border ${u.isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}">
          <div class="w-9 h-9 rounded-full ${u.isActive ? 'bg-green-200 text-green-700' : 'bg-gray-200 text-gray-500'} flex items-center justify-center font-semibold text-sm">${initial}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium ${u.isActive ? 'text-green-700' : 'text-gray-700'}">${escHtml(u.name)}</p>
              ${u.isActive ? '<span class="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-medium">Active</span>' : ''}
            </div>
            <p class="text-xs ${isExpired ? 'text-red-500' : 'text-gray-400'}">${isExpired ? 'Token expired' : 'Expires: ' + new Date(u.expires).toLocaleDateString()}</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            ${!u.isActive ? `<button onclick="setActiveUser(${u.id})" class="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-lg hover:bg-brand-100 font-medium">Set Active</button>` : ''}
            <button onclick="removeLinkedInUser(${u.id}, '${escAttr(u.name)}')" class="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">Publishing as:</span>
            ${postingBadge}
          </div>
        </div>

        <div class="space-y-2">
          ${usersHtml}
        </div>

        <div class="flex gap-2">
          <a href="/auth/linkedin" class="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i> Add Another Admin
          </a>
          ${!status.hasOrgAccess ? `
          <a href="/auth/linkedin?org=1" class="flex items-center gap-1.5 text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600">
            <i data-lucide="building-2" class="w-3.5 h-3.5"></i> Connect with Company Access
          </a>
          ` : ''}
        </div>

        ${!status.hasOrgAccess ? `
        <div class="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
          <p class="text-xs text-amber-700">Posts currently go to personal profile. Request <strong>Community Management API</strong> on LinkedIn Developer Portal, then reconnect with "Company Access" to post as TLB.</p>
        </div>
        ` : ''}
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <i data-lucide="link" class="w-4 h-4 text-gray-400"></i>
        </div>
        <div class="flex-1">
          <p class="text-sm text-gray-600">Connect your LinkedIn account to enable publishing</p>
        </div>
        <a href="/auth/linkedin" class="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
          <i data-lucide="linkedin" class="w-3.5 h-3.5"></i> Connect LinkedIn
        </a>
      </div>
    `;
  }
  lucide.createIcons();
}

async function setActiveUser(userId) {
  await api('/api/linkedin/set-active', { method: 'POST', body: { userId } });
  showToast('Active publisher updated');
  loadLinkedInStatus();
}

async function removeLinkedInUser(userId, name) {
  if (!confirm(`Remove ${name} from the dashboard?`)) return;
  await api('/api/linkedin/remove-user', { method: 'POST', body: { userId } });
  showToast(`${name} removed`, 'info');
  loadLinkedInStatus();
}

async function disconnectLinkedIn() {
  if (!confirm('Disconnect ALL LinkedIn accounts? Scheduled posts will not be published.')) return;
  await api('/api/linkedin/disconnect', { method: 'POST' });
  showToast('All accounts disconnected', 'info');
  loadLinkedInStatus();
}

async function saveSettings() {
  const freq = document.getElementById('setting-frequency').value;
  const tone = document.getElementById('setting-tone').value;
  await api('/api/settings', { method: 'PATCH', body: { post_frequency: freq, tone } });
  showToast('Settings saved!');
}

// ==================== CALENDAR ====================
async function loadCalendar() {
  const { posts } = await api('/api/posts/scheduled');
  const container = document.getElementById('calendar-list');
  if (!container) return;

  if (!posts.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">No scheduled or published posts yet.</div>';
    return;
  }

  // Group by date
  const grouped = {};
  posts.forEach(p => {
    const dateStr = p.scheduled_at || p.published_at;
    const date = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(p);
  });

  container.innerHTML = Object.entries(grouped).map(([date, datePosts]) => `
    <div>
      <h3 class="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
        <i data-lucide="calendar" class="w-4 h-4"></i> ${date}
      </h3>
      <div class="space-y-3">
        ${datePosts.map(p => `
          <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-4">
            <div class="w-12 text-center flex-shrink-0">
              <p class="text-lg font-bold text-gray-700">${new Date(p.scheduled_at || p.published_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(p.status)}">${p.status}</span>
                ${p.region ? `<span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${regionClass(p.region)}">${p.region}</span>` : ''}
              </div>
              <p class="text-sm text-gray-700 line-clamp-2">${escHtml(p.content.substring(0, 120))}...</p>
              ${p.article_title ? `<p class="text-xs text-gray-400 mt-1">Based on: ${escHtml(p.article_title)}</p>` : ''}
            </div>
            ${p.status === 'scheduled' ? `
              <button onclick="cancelSchedule(${p.id})" class="text-xs text-red-500 hover:text-red-700 flex-shrink-0">Cancel</button>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

// ==================== LINKEDIN ARTICLES ====================
let currentLAFilter = '';
let editingArticleId = null;
let coverGenArticleId = null;
let previewArticleContent = '';

async function loadLinkedinArticles() {
  const params = currentLAFilter ? `?status=${currentLAFilter}` : '';
  const { articles } = await api(`/api/linkedin-articles${params}`);
  renderLinkedinArticles(articles);
  lucide.createIcons();
}

function filterLinkedinArticles(status) {
  currentLAFilter = status;
  document.querySelectorAll('.la-tab').forEach(tab => {
    if (tab.dataset.status === status) {
      tab.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
      tab.classList.remove('text-gray-500');
    } else {
      tab.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
      tab.classList.add('text-gray-500');
    }
  });
  loadLinkedinArticles();
}

function renderLinkedinArticles(articles) {
  const container = document.getElementById('linkedin-articles-list');
  if (!articles.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-gray-400">No articles yet. Click "New Article" to get started.</div>';
    return;
  }

  container.innerHTML = articles.map(a => {
    const typeLabels = { educational: 'Educational', market_analysis: 'Market Analysis', land_security: 'Land Security', land_documents: 'Documents Guide' };
    const wordCount = (a.content || '').split(/\s+/).length;
    return `
    <div class="bg-white rounded-xl border border-gray-100 p-5">
      <div class="flex items-start gap-4">
        ${a.cover_image ? `<img src="${a.cover_image}" class="w-32 h-20 rounded-lg object-cover flex-shrink-0" />` : `
        <div class="w-32 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
          <i data-lucide="image" class="w-6 h-6 text-gray-300"></i>
        </div>`}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(a.status)}">${a.status}</span>
            <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-600">${typeLabels[a.article_type] || a.article_type}</span>
            <span class="text-xs text-gray-400">${wordCount} words</span>
          </div>
          <h4 class="text-sm font-semibold text-gray-800 leading-snug mb-0.5">${escHtml(a.title)}</h4>
          ${a.subtitle ? `<p class="text-xs text-gray-500 mb-1">${escHtml(a.subtitle)}</p>` : ''}
          ${a.source_title ? `<p class="text-xs text-gray-400">Based on: ${escHtml(a.source_title)}</p>` : ''}
          ${a.source_topic ? `<p class="text-xs text-gray-400">Topic: ${escHtml(a.source_topic)}</p>` : ''}
        </div>
        <span class="text-xs text-gray-400 flex-shrink-0">${timeAgo(a.created_at)}</span>
      </div>

      <div class="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-gray-50">
        <div class="flex gap-2">
          <button onclick="previewLinkedinArticle(${a.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
          </button>
          <button onclick="editLinkedinArticle(${a.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Edit
          </button>
          <button onclick="copyLinkedinArticle(${a.id})" id="btn-copy-la-${a.id}" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
          </button>
          <button onclick="regenerateLinkedinArticle(${a.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Regenerate
          </button>
          ${!a.cover_image ? `
          <button onclick="openArticleCoverModal(${a.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="image" class="w-3.5 h-3.5"></i> Cover Image
          </button>
          ` : `
          <button onclick="openArticleCoverModal(${a.id})" class="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition border border-gray-200">
            <i data-lucide="image" class="w-3.5 h-3.5"></i> New Cover
          </button>
          `}
        </div>
        <div class="flex gap-2">
          ${a.status === 'draft' ? `
            <button onclick="approveLinkedinArticle(${a.id})" class="flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Approve
            </button>
          ` : ''}
          ${a.status === 'approved' ? `
            <button onclick="publishLinkedinArticle(${a.id})" id="btn-pub-la-${a.id}" class="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i> Publish as Article
            </button>
          ` : ''}
          ${a.status === 'published' ? `
            <span class="text-xs text-green-600 flex items-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Published ${timeAgo(a.published_at)}
            </span>
            <button onclick="publishLinkedinArticle(${a.id})" class="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-emerald-100 transition">
              <i data-lucide="repeat" class="w-3.5 h-3.5"></i> Republish as Article
            </button>
          ` : ''}
          <button onclick="deleteLinkedinArticle(${a.id})" class="flex items-center gap-1.5 text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg text-xs hover:bg-red-50 transition">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `}).join('');
}

async function quickGenerateArticle(articleId) {
  // Open the new article modal pre-filled with this news article
  await openNewArticleModal();
  document.getElementById('art-news-select').value = String(articleId);
}

async function openNewArticleModal() {
  document.getElementById('modal-new-article').classList.remove('hidden');
  switchArticleSource('news');
  // Load news articles for dropdown
  const { articles } = await api('/api/articles?status=new&limit=50');
  const select = document.getElementById('art-news-select');
  if (articles.length) {
    select.innerHTML = '<option value="">Select an article...</option>' +
      articles.map(a => `<option value="${a.id}">${escHtml(a.title)} (${a.region})</option>`).join('');
  } else {
    select.innerHTML = '<option value="">No new articles. Fetch news first or use custom topic.</option>';
  }
  lucide.createIcons();
}

function switchArticleSource(src) {
  if (src === 'news') {
    document.getElementById('art-source-news').classList.remove('hidden');
    document.getElementById('art-source-custom').classList.add('hidden');
    document.getElementById('art-src-news').classList.add('bg-white', 'text-gray-800', 'shadow-sm');
    document.getElementById('art-src-news').classList.remove('text-gray-500');
    document.getElementById('art-src-custom').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
    document.getElementById('art-src-custom').classList.add('text-gray-500');
  } else {
    document.getElementById('art-source-news').classList.add('hidden');
    document.getElementById('art-source-custom').classList.remove('hidden');
    document.getElementById('art-src-custom').classList.add('bg-white', 'text-gray-800', 'shadow-sm');
    document.getElementById('art-src-custom').classList.remove('text-gray-500');
    document.getElementById('art-src-news').classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
    document.getElementById('art-src-news').classList.add('text-gray-500');
  }
}

async function generateLinkedinArticle() {
  const btn = document.getElementById('btn-gen-article');
  const articleType = document.getElementById('art-type-select').value;
  const newsId = document.getElementById('art-news-select').value;
  const customTopic = document.getElementById('art-custom-topic').value.trim();
  const isCustom = !document.getElementById('art-source-custom').classList.contains('hidden');

  if (!isCustom && !newsId) { showToast('Select a news article', 'error'); return; }
  if (isCustom && !customTopic) { showToast('Enter a topic', 'error'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating article...';

  try {
    const body = { articleType };
    if (isCustom) {
      body.topic = customTopic;
    } else {
      body.articleId = Number(newsId);
    }
    const result = await api('/api/linkedin-articles/generate', { method: 'POST', body });
    if (result.error) throw new Error(result.error);

    closeModal('modal-new-article');
    showToast('Article generated!');
    loadLinkedinArticles();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> Generate Article';
    lucide.createIcons();
  }
}

async function editLinkedinArticle(id) {
  editingArticleId = id;
  const article = await api(`/api/linkedin-articles/${id}`);
  if (article.error) return;
  document.getElementById('edit-art-title').value = article.title || '';
  document.getElementById('edit-art-subtitle').value = article.subtitle || '';
  document.getElementById('edit-art-content').value = article.content || '';
  document.getElementById('edit-art-cover-prompt').value = article.cover_image_prompt || '';
  document.getElementById('modal-edit-article').classList.remove('hidden');
  lucide.createIcons();
}

async function saveArticleEdit() {
  const title = document.getElementById('edit-art-title').value;
  const subtitle = document.getElementById('edit-art-subtitle').value;
  const content = document.getElementById('edit-art-content').value;
  const cover_image_prompt = document.getElementById('edit-art-cover-prompt').value;
  await api(`/api/linkedin-articles/${editingArticleId}`, { method: 'PATCH', body: { title, subtitle, content, cover_image_prompt } });
  closeModal('modal-edit-article');
  showToast('Article updated!');
  loadLinkedinArticles();
}

async function previewLinkedinArticle(id) {
  const article = await api(`/api/linkedin-articles/${id}`);
  if (article.error) return;
  previewArticleContent = `${article.title}\n\n${article.subtitle || ''}\n\n${article.content}`;

  document.getElementById('preview-art-title').textContent = article.title;
  document.getElementById('preview-art-subtitle').textContent = article.subtitle || '';

  const coverContainer = document.getElementById('preview-art-cover');
  if (article.cover_image) {
    document.getElementById('preview-art-cover-img').src = article.cover_image;
    coverContainer.classList.remove('hidden');
  } else {
    coverContainer.classList.add('hidden');
  }

  // Render content with basic markdown support
  const contentDiv = document.getElementById('preview-art-content');
  contentDiv.innerHTML = renderArticleMarkdown(article.content);

  document.getElementById('modal-preview-article').classList.remove('hidden');
  lucide.createIcons();
}

function renderArticleMarkdown(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => {
      if (line.startsWith('## ')) return `<h2 class="text-lg font-semibold text-gray-800 mt-6 mb-2">${escHtml(line.slice(3))}</h2>`;
      if (line.startsWith('# ')) return `<h1 class="text-xl font-bold text-gray-900 mt-6 mb-2">${escHtml(line.slice(2))}</h1>`;
      if (line.startsWith('- ')) return `<li class="ml-4 text-sm text-gray-700 mb-1">${escHtml(line.slice(2))}</li>`;
      if (line.startsWith('* ')) return `<li class="ml-4 text-sm text-gray-700 mb-1">${escHtml(line.slice(2))}</li>`;
      if (line.match(/^\d+\.\s/)) return `<li class="ml-4 text-sm text-gray-700 mb-1">${escHtml(line)}</li>`;
      if (line.trim() === '') return '<br>';
      return `<p class="text-sm text-gray-700 mb-2">${escHtml(line)}</p>`;
    })
    .join('');
}

async function copyLinkedinArticle(id) {
  const article = await api(`/api/linkedin-articles/${id}`);
  if (article.error) return;
  const fullText = `${article.title}\n\n${article.subtitle || ''}\n\n${article.content}`;
  try {
    await navigator.clipboard.writeText(fullText);
    const btn = document.getElementById(`btn-copy-la-${id}`);
    if (btn) {
      btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied!';
      btn.classList.add('text-green-600', 'border-green-200', 'bg-green-50');
      lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = '<i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy';
        btn.classList.remove('text-green-600', 'border-green-200', 'bg-green-50');
        lucide.createIcons();
      }, 2000);
    }
  } catch {
    showToast('Failed to copy', 'error');
  }
}

async function copyArticleContent() {
  try {
    await navigator.clipboard.writeText(previewArticleContent);
    const btn = document.getElementById('btn-copy-article');
    btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Copied!';
    btn.classList.add('bg-green-600');
    btn.classList.remove('bg-gray-800');
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i> Copy Article';
      btn.classList.remove('bg-green-600');
      btn.classList.add('bg-gray-800');
      lucide.createIcons();
    }, 2000);
  } catch {
    showToast('Failed to copy', 'error');
  }
}

async function regenerateLinkedinArticle(id) {
  if (!confirm('Regenerate this article? The current content will be replaced.')) return;
  showToast('Regenerating article...', 'info');
  try {
    const result = await api(`/api/linkedin-articles/${id}/regenerate`, { method: 'POST', body: {} });
    if (result.error) throw new Error(result.error);
    showToast('Article regenerated!');
    loadLinkedinArticles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveLinkedinArticle(id) {
  await api(`/api/linkedin-articles/${id}`, { method: 'PATCH', body: { status: 'approved' } });
  showToast('Article approved!');
  loadLinkedinArticles();
}

async function deleteLinkedinArticle(id) {
  if (!confirm('Delete this article?')) return;
  await api(`/api/linkedin-articles/${id}`, { method: 'DELETE' });
  showToast('Article deleted', 'info');
  loadLinkedinArticles();
}

async function publishLinkedinArticle(id) {
  const article = await api(`/api/linkedin-articles/${id}`);
  if (article.error) { showToast('Article not found', 'error'); return; }

  // Show a publish instructions modal
  const fullText = `${article.title}\n\n${article.subtitle || ''}\n\n${article.content}`;
  try {
    await navigator.clipboard.writeText(fullText);
  } catch { /* will handle below */ }

  // If cover image exists, store it for download
  publishingArticle = article;
  document.getElementById('publish-art-title').textContent = article.title;

  const coverInfo = document.getElementById('publish-art-cover-info');
  if (article.cover_image) {
    coverInfo.innerHTML = `
      <img src="${article.cover_image}" class="w-full rounded-lg mb-2 max-h-40 object-cover" />
      <button onclick="downloadCoverImage()" class="flex items-center gap-1.5 text-blue-600 text-xs hover:underline">
        <i data-lucide="download" class="w-3.5 h-3.5"></i> Download cover image
      </button>
    `;
  } else {
    coverInfo.innerHTML = '<p class="text-xs text-gray-400">No cover image generated</p>';
  }

  document.getElementById('modal-publish-article').classList.remove('hidden');
  lucide.createIcons();
}

let publishingArticle = null;

function downloadCoverImage() {
  if (!publishingArticle || !publishingArticle.cover_image) return;
  const link = document.createElement('a');
  link.href = publishingArticle.cover_image;
  link.download = `cover-${publishingArticle.id}.png`;
  link.click();
  showToast('Cover image downloaded!');
}

async function publishArticleAsPost(id) {
  const btn = document.getElementById(`btn-post-la-${id}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Publishing...';
  }

  try {
    const result = await api(`/api/linkedin-articles/${id}/publish`, { method: 'POST', body: {} });
    if (result.error) throw new Error(result.error);
    showToast('Article published as LinkedIn post!');
    loadLinkedinArticles();
    loadDashboard();
  } catch (err) {
    showToast(err.message || 'Failed to publish', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i> Auto Post';
      lucide.createIcons();
    }
  }
}

async function confirmPublishArticle() {
  if (!publishingArticle) return;

  const fullText = `${publishingArticle.title}\n\n${publishingArticle.subtitle || ''}\n\n${publishingArticle.content}`;
  try {
    await navigator.clipboard.writeText(fullText);
    showToast('Article content copied!');
  } catch {
    showToast('Could not copy automatically. Please copy from preview.', 'error');
  }

  // Mark as published
  await api(`/api/linkedin-articles/${publishingArticle.id}`, { method: 'PATCH', body: { status: 'published' } });

  // Open LinkedIn article editor as company page
  window.open('https://www.linkedin.com/article/new/?author=urn%3Ali%3Afsd_company%3A112976963', '_blank');

  closeModal('modal-publish-article');
  loadLinkedinArticles();
  loadDashboard();
}

let selectedCoverStyle = 'photorealistic';

function selectCoverStyle(style) {
  selectedCoverStyle = style;
  document.querySelectorAll('.cover-style-btn').forEach(btn => {
    if (btn.dataset.style === style) {
      btn.classList.add('border-brand-500', 'bg-brand-50');
      btn.classList.remove('border-gray-200');
    } else {
      btn.classList.remove('border-brand-500', 'bg-brand-50');
      btn.classList.add('border-gray-200');
    }
  });
}

async function openArticleCoverModal(id) {
  coverGenArticleId = id;
  selectedCoverStyle = 'photorealistic';
  const article = await api(`/api/linkedin-articles/${id}`);
  if (article.error) return;
  document.getElementById('art-cover-prompt').value = article.cover_image_prompt || '';
  document.getElementById('art-cover-preview').classList.add('hidden');
  selectCoverStyle('photorealistic');
  document.getElementById('modal-article-cover').classList.remove('hidden');
  lucide.createIcons();
}

async function confirmArticleCoverGen() {
  const prompt = document.getElementById('art-cover-prompt').value.trim();
  if (!prompt) { showToast('Enter an image prompt', 'error'); return; }

  const btn = document.getElementById('btn-art-cover-gen');
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-25"></circle><path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3" stroke-linecap="round" class="opacity-75"></path></svg> Generating...';

  try {
    const coverStylePrompt = IMAGE_STYLE_PROMPTS[selectedCoverStyle] || '';
    const fullCoverPrompt = coverStylePrompt ? `${coverStylePrompt} ${prompt}` : prompt;
    const result = await api(`/api/linkedin-articles/${coverGenArticleId}/generate-cover`, {
      method: 'POST',
      body: { imagePrompt: fullCoverPrompt }
    });

    if (result.imageUrl) {
      document.getElementById('art-cover-preview-img').src = result.imageUrl;
      document.getElementById('art-cover-preview').classList.remove('hidden');
      showToast('Cover image generated!');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Done';
      btn.onclick = function() { closeModal('modal-article-cover'); loadLinkedinArticles(); btn.onclick = confirmArticleCoverGen; };
      lucide.createIcons();
      return;
    } else {
      showToast('Cover image generation failed', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Failed to generate cover', 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="image" class="w-4 h-4"></i> Generate Cover';
  lucide.createIcons();
}

// ==================== HELPERS ====================
function regionClass(region) {
  const map = {
    odisha: 'bg-amber-50 text-amber-600',
    karnataka: 'bg-emerald-50 text-emerald-600',
    national: 'bg-sky-50 text-sky-600'
  };
  return map[region] || 'bg-gray-100 text-gray-500';
}

function statusClass(status) {
  const map = {
    draft: 'bg-purple-50 text-purple-600',
    approved: 'bg-green-50 text-green-600',
    scheduled: 'bg-amber-50 text-amber-600',
    published: 'bg-sky-50 text-sky-600',
    failed: 'bg-red-50 text-red-600',
    new: 'bg-blue-50 text-blue-600'
  };
  return map[status] || 'bg-gray-100 text-gray-500';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  // SQLite datetime('now') stores UTC without 'Z', so append it for correct parsing
  const dateVal = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(dateVal).getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return escHtml(str).replace(/'/g, '&#39;');
}

// ==================== SIDEBAR USER ====================
async function updateSidebarUser() {
  // Show logged-in user email
  try {
    const auth = await api('/api/auth/me');
    if (auth.email) {
      const emailEl = document.getElementById('sidebar-user-email');
      if (emailEl) emailEl.textContent = auth.email;
      const initial = auth.email[0].toUpperCase();
      const avatarEl = document.querySelector('#sidebar-user .w-8');
      if (avatarEl) {
        avatarEl.className = 'w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-sm';
        avatarEl.textContent = initial;
      }
    }
  } catch {}
}

async function logout() {
  if (!confirm('Log out of the dashboard?')) return;
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

// ==================== MOBILE SIDEBAR ====================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('-translate-x-full');
  overlay.classList.toggle('hidden');
}

function closeSidebarMobile() {
  if (window.innerWidth < 1024) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  }
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  loadDashboard();
});
