// ==================== STATE ====================
let currentPage = 'home';

// URL <-> page mapping
const PAGE_TO_PATH = {
  home: '/',
  dashboard: '/dashboard',
  news: '/news',
  posts: '/posts',
  'write-article': '/articles',
  'post-creation': '/post-creation',
  posters: '/post-creation', // alias
  calendar: '/calendar',
  settings: '/settings'
};
const PATH_TO_PAGE = {
  '/': 'home',
  '/dashboard': 'dashboard',
  '/news': 'news',
  '/posts': 'posts',
  '/articles': 'write-article',
  '/post-creation': 'post-creation',
  '/calendar': 'calendar',
  '/settings': 'settings'
};
let currentPostFilter = '';
let selectedArticleId = null;
let editingPostId = null;
let previewPostContent = '';

const API = '';

// ==================== NAVIGATION ====================
function navigate(page, opts = {}) {
  // Alias: post-creation routes to the posters page div
  const pageDivId = page === 'post-creation' ? 'page-posters' : `page-${page}`;

  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(pageDivId);
  if (target) target.classList.remove('hidden');

  // Toggle sidebar visibility — home and post-creation are full-bleed
  // (left nav belongs to the LinkedIn Automation flow only)
  const sidebar = document.getElementById('sidebar');
  const main = document.querySelector('main');
  const STANDALONE_PAGES = ['home', 'post-creation'];
  if (STANDALONE_PAGES.includes(page)) {
    sidebar.classList.add('lg:hidden');
    main.classList.remove('lg:ml-60');
  } else {
    sidebar.classList.remove('lg:hidden');
    main.classList.add('lg:ml-60');
  }

  // Sidebar active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('text-brand-600', 'bg-brand-50', 'font-medium');
    link.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');
  });
  const navKey = page === 'post-creation' ? 'posters' : page;
  const activeLink = document.querySelector(`.nav-link[data-page="${navKey}"]`);
  if (activeLink) {
    activeLink.classList.add('text-brand-600', 'bg-brand-50', 'font-medium');
    activeLink.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-50');
  }

  // Load page data
  if (page === 'dashboard') loadDashboard();
  if (page === 'news') loadArticles();
  if (page === 'posts') loadPosts();
  if (page === 'write-article') loadLinkedinArticles();
  if (page === 'posters' || page === 'post-creation') loadPosters();
  if (page === 'calendar') loadCalendar();
  if (page === 'settings') loadSettings();

  // Update URL (unless triggered by popstate)
  if (!opts.fromPop) {
    const path = PAGE_TO_PATH[page] || '/';
    if (window.location.pathname !== path) {
      history.pushState({ page }, '', path);
    }
  }

  lucide.createIcons();
}

window.addEventListener('popstate', () => {
  const page = PATH_TO_PAGE[window.location.pathname] || 'home';
  navigate(page, { fromPop: true });
});

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

// ==================== POSTERS ====================
let posterOptions = null;
let posterSelectedBgStyle = 'graphics';
let posterSelectedSize = 'square';
let posterSelectedLanguage = 'english';
let posterSelectedLayout = 'auto';

// Values that should render with a small "NEW" badge to flag recently-added
// options in the Create Poster modal.
const POSTER_NEW_VALUES = new Set(['youtube', 'lineart', 'painting']);

function posterNewBadge(value) {
  return POSTER_NEW_VALUES.has(value)
    ? '<span class="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold uppercase tracking-wider align-middle">New</span>'
    : '';
}

// Short one-line descriptions for each layout option in the Create Poster
// modal. Used alongside the mini wireframe to make each layout self-evident.
const POSTER_LAYOUT_META = {
  'auto':           { desc: 'Rotate through all layouts' },
  'center-classic': { desc: 'Text centered, balanced' },
  'bottom-left':    { desc: 'Anchored bottom-left' },
  'top-hero':       { desc: 'Big headline up top' },
  'minimal-center': { desc: 'Just the headline' }
};

// Tiny SVG wireframes that mirror each layout's text placement. Teal bars
// represent the headline, grey bars represent subtext/tagline, the dot is
// the logo. Kept minimal so the layout's shape reads instantly at thumbnail
// size — this is the main reason this section can't use the plain pill
// renderer used elsewhere.
function layoutWireframeSvg(value) {
  const TEAL = '#30B0A4';
  const GRAY_DARK = '#9CA3AF';
  const GRAY_LIGHT = '#D1D5DB';
  const LOGO = '#6B7280';
  const frame = `<rect x="2" y="2" width="96" height="96" rx="6" ry="6" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="1"/>`;

  switch (value) {
    case 'center-classic':
      return `<svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
        ${frame}
        <rect x="20" y="36" width="60" height="9" rx="1.5" fill="${TEAL}"/>
        <rect x="26" y="49" width="48" height="3" rx="1" fill="${GRAY_DARK}"/>
        <rect x="32" y="55" width="36" height="2.5" rx="1" fill="${GRAY_LIGHT}"/>
        <circle cx="50" cy="85" r="3" fill="${LOGO}"/>
      </svg>`;
    case 'bottom-left':
      return `<svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
        ${frame}
        <rect x="10" y="54" width="58" height="9" rx="1.5" fill="${TEAL}"/>
        <rect x="10" y="67" width="46" height="3" rx="1" fill="${GRAY_DARK}"/>
        <rect x="10" y="74" width="36" height="2.5" rx="1" fill="${GRAY_LIGHT}"/>
        <circle cx="14" cy="88" r="3" fill="${LOGO}"/>
      </svg>`;
    case 'top-hero':
      return `<svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
        ${frame}
        <rect x="14" y="14" width="72" height="10" rx="1.5" fill="${TEAL}"/>
        <rect x="20" y="28" width="60" height="3" rx="1" fill="${GRAY_DARK}"/>
        <rect x="26" y="34" width="48" height="2.5" rx="1" fill="${GRAY_LIGHT}"/>
        <circle cx="50" cy="86" r="3" fill="${LOGO}"/>
      </svg>`;
    case 'minimal-center':
      return `<svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
        ${frame}
        <rect x="12" y="43" width="76" height="14" rx="2" fill="${TEAL}"/>
        <circle cx="50" cy="86" r="2.5" fill="${LOGO}"/>
      </svg>`;
    case 'auto':
    default:
      return `<svg viewBox="0 0 100 100" class="w-full h-full" aria-hidden="true">
        <rect x="3" y="3" width="94" height="94" rx="6" ry="6" fill="#F9FAFB" stroke="${TEAL}" stroke-width="1.5" stroke-dasharray="3 2"/>
        <path d="M50 30 L53 42 L65 45 L53 48 L50 60 L47 48 L35 45 L47 42 Z" fill="${TEAL}"/>
        <rect x="25" y="70" width="50" height="3" rx="1" fill="${GRAY_DARK}"/>
        <rect x="32" y="78" width="36" height="2.5" rx="1" fill="${GRAY_LIGHT}"/>
      </svg>`;
  }
}

function renderPosterLayoutCards(layouts) {
  const grid = document.getElementById('poster-layout-grid');
  if (!grid) return;
  const activeCls = 'border-brand-500 bg-brand-50 ring-1 ring-brand-200';
  const idleCls = 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
  const baseCls = 'poster-layout-card text-center p-1.5 rounded-lg border transition w-full';
  // Compact 5-across grid (3 on mobile) so all layouts fit in one row on desktop
  grid.className = 'grid grid-cols-3 sm:grid-cols-5 gap-1.5';
  grid.innerHTML = layouts.map(item => {
    const desc = (POSTER_LAYOUT_META[item.value] || {}).desc || '';
    const active = item.value === posterSelectedLayout;
    return `<button type="button" data-value="${item.value}" title="${escHtml(desc)}"
      class="${baseCls} ${active ? activeCls : idleCls}">
      <div class="w-full mb-1 overflow-hidden rounded flex items-center justify-center">
        <div class="w-12 h-12">${layoutWireframeSvg(item.value)}</div>
      </div>
      <div class="text-[10px] font-medium text-gray-700 leading-tight truncate">${escHtml(item.label)}</div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.poster-layout-card').forEach(btn => {
    btn.addEventListener('click', () => {
      posterSelectedLayout = btn.dataset.value;
      grid.querySelectorAll('.poster-layout-card').forEach(b => {
        const isActive = b.dataset.value === posterSelectedLayout;
        b.className = `${baseCls} ${isActive ? activeCls : idleCls}`;
      });
    });
  });
}

// Shared renderer for the tag-style selectable groups in the Create Poster
// modal. `items` is an array of { value, label }, `getSelected` returns the
// currently selected value, and `onSelect` is called with the new value.
function renderPosterTagGroup(gridId, items, getSelected, onSelect) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = items.map(item => {
    const active = item.value === getSelected();
    const cls = active
      ? 'border-brand-500 bg-brand-50 text-brand-700'
      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50';
    return `<button type="button" data-value="${item.value}"
      class="poster-tag-btn px-3 py-1.5 rounded-full border text-xs font-medium transition ${cls}">
      ${escHtml(item.label)}${posterNewBadge(item.value)}
    </button>`;
  }).join('');
  grid.querySelectorAll('.poster-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onSelect(btn.dataset.value);
      // Repaint this group so the active styles swap
      grid.querySelectorAll('.poster-tag-btn').forEach(b => {
        const isActive = b.dataset.value === getSelected();
        b.className = 'poster-tag-btn px-3 py-1.5 rounded-full border text-xs font-medium transition ' +
          (isActive
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50');
      });
    });
  });
}
let currentPreviewPoster = null;
let posterTipTimer = null;

// Rotating "Did you know?" marketing tips shown while a poster is generating.
// Mix of land/property stats, social media best practices, and TLB product hints.
const POSTER_TIPS = [
  'Short headlines (2 to 4 words) are remembered about 5x better than long ones.',
  'Festive creatives posted 2 to 3 days before the festival outperform day-of posts by nearly 2x.',
  'Posts featuring real human faces tend to get ~38% more engagement on Instagram and Facebook.',
  'Square (1:1) posts consistently outperform landscape posts on Instagram feeds.',
  'The best windows for real-estate content on LinkedIn are Tuesday and Wednesday mornings (10 to 11 AM IST).',
  'Over 65% of land disputes in India stem from unclear or missing documentation.',
  'Trust signals like "verified", "registered" and "certified" can nearly double click-through rates on land ads.',
  'More than 40% of property searches on mobile happen after 8 PM.',
  'Kerala and Karnataka lead India in digital land-record adoption.',
  'Every TLB poster auto-picks the dark or white logo based on how bright the background is.',
  'Pro tip: use the "Your idea / brief" field to push colours or mood, e.g. "warm golden hour".',
  'Gemini generates a fresh background image each time, so no two posters are ever identical.',
  'Auto layout mode quietly rotates between 4 distinct templates so your feed never looks templated.',
  'TLB brand teal (#30B0A4) is tuned for maximum readability on warm, cinematic backgrounds.',
  'Consistency beats frequency: one on-brand poster a day beats five noisy ones a week.'
];

function showPosterGenerating() {
  const body = document.getElementById('poster-form-body');
  const footer = document.getElementById('poster-form-footer');
  const gen = document.getElementById('poster-generating');
  if (!body || !gen || !footer) return;
  body.classList.add('hidden');
  footer.classList.add('hidden');
  gen.classList.remove('hidden');
  startPosterTipRotation();
  if (window.lucide) lucide.createIcons();
}

function hidePosterGenerating() {
  const body = document.getElementById('poster-form-body');
  const footer = document.getElementById('poster-form-footer');
  const gen = document.getElementById('poster-generating');
  stopPosterTipRotation();
  if (!body || !gen || !footer) return;
  gen.classList.add('hidden');
  body.classList.remove('hidden');
  footer.classList.remove('hidden');
}

function startPosterTipRotation() {
  const tipEl = document.getElementById('poster-tip');
  if (!tipEl) return;
  let i = Math.floor(Math.random() * POSTER_TIPS.length);
  tipEl.textContent = POSTER_TIPS[i];
  tipEl.style.opacity = '1';
  stopPosterTipRotation();
  posterTipTimer = setInterval(() => {
    tipEl.style.opacity = '0';
    setTimeout(() => {
      i = (i + 1) % POSTER_TIPS.length;
      tipEl.textContent = POSTER_TIPS[i];
      tipEl.style.opacity = '1';
    }, 300);
  }, 5000);
}

function stopPosterTipRotation() {
  if (posterTipTimer) {
    clearInterval(posterTipTimer);
    posterTipTimer = null;
  }
}

async function loadPosterOptions() {
  if (posterOptions) return posterOptions;
  posterOptions = await api('/api/poster-options');
  return posterOptions;
}

// Latest poster list, kept so the view-mode toggle can re-render without
// refetching. Updated each time loadPosters() runs.
let cachedPosters = [];
let posterViewMode = localStorage.getItem('posterViewMode') === 'list' ? 'list' : 'grid';

async function loadPosters() {
  await loadPosterOptions();
  const { posters } = await api('/api/posters?limit=60');
  cachedPosters = posters;
  renderPosters(cachedPosters);
  lucide.createIcons();
}

function setPosterViewMode(mode) {
  if (mode !== 'grid' && mode !== 'list') return;
  posterViewMode = mode;
  localStorage.setItem('posterViewMode', mode);
  renderPosters(cachedPosters);
  lucide.createIcons();
}

function updatePosterViewToggleUi() {
  const toggle = document.getElementById('posters-view-toggle');
  if (!toggle) return;
  toggle.querySelectorAll('.poster-view-btn').forEach(btn => {
    const active = btn.dataset.mode === posterViewMode;
    btn.classList.toggle('bg-brand-50', active);
    btn.classList.toggle('text-brand-700', active);
    btn.classList.toggle('text-gray-400', !active);
    btn.classList.toggle('hover:text-gray-600', !active);
  });
}

// Return a Date set to the start of the local day for the given SQLite
// datetime string (stored as UTC without timezone).
function localDayStart(dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z';
  const d = new Date(normalized);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Bucket posters by created_at day in local time. Returns an ordered array
// of { label, posters } sections, newest first, with "Today" and
// "Yesterday" getting friendly labels and older days getting a formatted
// absolute date.
function groupPostersByDay(posters) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const order = [];
  const byKey = new Map();
  for (const p of posters) {
    const day = localDayStart(p.created_at) || today;
    const key = day.getTime();
    let label;
    if (key === today.getTime()) label = 'Today';
    else if (key === yesterday.getTime()) label = 'Yesterday';
    else label = fmt.format(day);
    if (!byKey.has(key)) {
      byKey.set(key, { key, label, posters: [] });
      order.push(key);
    }
    byKey.get(key).posters.push(p);
  }
  // Newest day first. Posters inside each bucket keep the server order.
  return order.sort((a, b) => b - a).map(k => byKey.get(k));
}

function renderPosterGridCard(p) {
  const occasionLabel = (posterOptions?.occasions.find(o => o.value === p.occasion)?.label) || p.occasion || '';
  const sizeLabel = (posterOptions?.sizes.find(s => s.value === p.size)?.label) || p.size || '';
  const langLabel = (posterOptions?.languages.find(l => l.value === p.language)?.label) || p.language || '';
  let platforms = []; try { platforms = JSON.parse(p.published_platforms || '[]'); } catch {}
  const isPublished = p.published_at && platforms.length;
  return `
    <div class="bg-white rounded-xl border border-gray-100 overflow-hidden group">
      <div class="bg-gray-100 relative cursor-pointer" onclick="openPosterPreview(${p.id})">
        <img src="${p.image_url}" class="w-full h-56 object-cover" />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span class="text-white text-xs font-medium flex items-center gap-1.5"><i data-lucide="eye" class="w-4 h-4"></i> View</span>
        </div>
        ${isPublished ? '<span class="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500 text-white text-[10px] font-medium shadow-sm"><i data-lucide="check-circle" class="w-3 h-3"></i> Published</span>' : ''}
      </div>
      <div class="p-4">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-600 uppercase tracking-wide">${escHtml(occasionLabel)}</span>
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">${escHtml(sizeLabel)}</span>
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">${escHtml(langLabel)}</span>
        </div>
        <p class="text-sm font-medium text-gray-800 leading-snug truncate">${escHtml(p.headline || '—')}</p>
        <p class="text-xs text-gray-400 mt-0.5 truncate">${escHtml(p.subtext || '')}</p>
        <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span class="text-xs text-gray-300">${timeAgo(p.created_at)}</span>
          <div class="flex gap-1">
            <button onclick="downloadPoster(${p.id})" title="Download" class="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-50 transition">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>
            <button onclick="regeneratePoster(${p.id})" title="Regenerate" class="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-50 transition">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            </button>
            <button onclick="deletePoster(${p.id})" title="Delete" class="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderPosterListCard(p) {
  const occasionLabel = (posterOptions?.occasions.find(o => o.value === p.occasion)?.label) || p.occasion || '';
  const sizeLabel = (posterOptions?.sizes.find(s => s.value === p.size)?.label) || p.size || '';
  const langLabel = (posterOptions?.languages.find(l => l.value === p.language)?.label) || p.language || '';
  let platforms = []; try { platforms = JSON.parse(p.published_platforms || '[]'); } catch {}
  const isPublished = p.published_at && platforms.length;
  return `
    <div class="bg-white rounded-xl border border-gray-100 flex items-center gap-4 p-3 hover:border-gray-200 transition">
      <div class="w-20 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 cursor-pointer relative" onclick="openPosterPreview(${p.id})">
        <img src="${p.image_url}" class="w-full h-full object-cover" />
        ${isPublished ? '<span class="absolute bottom-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><i data-lucide="check" class="w-2.5 h-2.5 text-white"></i></span>' : ''}
      </div>
      <div class="flex-1 min-w-0 cursor-pointer" onclick="openPosterPreview(${p.id})">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-600 uppercase tracking-wide">${escHtml(occasionLabel)}</span>
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">${escHtml(sizeLabel)}</span>
          <span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">${escHtml(langLabel)}</span>
          ${isPublished ? '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">Published</span>' : ''}
        </div>
        <p class="text-sm font-medium text-gray-800 leading-snug truncate">${escHtml(p.headline || '—')}</p>
        <p class="text-xs text-gray-400 mt-0.5 truncate">${escHtml(p.subtext || '')}</p>
      </div>
      <div class="flex items-center gap-4 flex-shrink-0">
        <span class="text-xs text-gray-300 whitespace-nowrap hidden sm:block">${timeAgo(p.created_at)}</span>
        <div class="flex gap-1">
          <button onclick="downloadPoster(${p.id})" title="Download" class="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-50 transition">
            <i data-lucide="download" class="w-4 h-4"></i>
          </button>
          <button onclick="regeneratePoster(${p.id})" title="Regenerate" class="text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-50 transition">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
          </button>
          <button onclick="deletePoster(${p.id})" title="Delete" class="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    </div>`;
}

function renderPosters(posters) {
  updatePosterViewToggleUi();
  const container = document.getElementById('posters-container');
  if (!container) return;
  if (!posters.length) {
    container.innerHTML = '<div class="bg-white rounded-xl border border-gray-100 p-10 text-center text-sm text-gray-400">No posters yet. Click "Create Poster" to design your first one.</div>';
    return;
  }
  const sections = groupPostersByDay(posters);
  const gridWrap = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5';
  const listWrap = 'flex flex-col gap-2';
  const renderCard = posterViewMode === 'list' ? renderPosterListCard : renderPosterGridCard;
  const wrapCls = posterViewMode === 'list' ? listWrap : gridWrap;

  container.innerHTML = sections.map(section => `
    <section>
      <div class="flex items-center gap-3 mb-3">
        <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider">${escHtml(section.label)}</h3>
        <span class="text-xs text-gray-300">${section.posters.length} poster${section.posters.length === 1 ? '' : 's'}</span>
        <div class="flex-1 h-px bg-gray-100"></div>
      </div>
      <div class="${wrapCls}">
        ${section.posters.map(renderCard).join('')}
      </div>
    </section>
  `).join('');
}

async function openPosterModal() {
  await loadPosterOptions();
  // Ensure the generating overlay is reset in case the previous attempt errored
  hidePosterGenerating();

  // Occasions — kept as a dropdown because the list is long
  const occSel = document.getElementById('poster-occasion');
  occSel.innerHTML = posterOptions.occasions.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  occSel.value = 'land_promo';

  // Reset selections to sensible defaults every time the modal opens
  posterSelectedSize = 'square';
  posterSelectedLanguage = 'english';
  posterSelectedLayout = 'auto';
  posterSelectedBgStyle = 'graphics';

  // Size (tag buttons)
  renderPosterTagGroup(
    'poster-size-grid',
    posterOptions.sizes,
    () => posterSelectedSize,
    (v) => { posterSelectedSize = v; }
  );

  // Language (tag buttons)
  renderPosterTagGroup(
    'poster-language-grid',
    posterOptions.languages,
    () => posterSelectedLanguage,
    (v) => { posterSelectedLanguage = v; }
  );

  // Layout (visual thumbnail cards — labels alone weren't self-explanatory)
  const layouts = posterOptions.layouts || [{ value: 'auto', label: 'Auto / Surprise me' }];
  renderPosterLayoutCards(layouts);

  // Background style grid (slightly larger card-style buttons)
  const bgGrid = document.getElementById('poster-bg-grid');
  const styleThumbs = {
    plain: '/assets/images/bg-plain.svg',
    graphics: '/assets/images/bg-graphics.svg',
    people: '/assets/images/bg-people.svg',
    cartoon: '/assets/images/bg-cartoon.svg',
    lineart: '/assets/images/bg-lineart.svg',
    painting: '/assets/images/bg-painting.svg'
  };
  const renderBgGrid = () => {
    bgGrid.innerHTML = posterOptions.backgroundStyles.map(s => {
      const active = s.value === posterSelectedBgStyle;
      const cls = active
        ? 'border-brand-500 bg-brand-50 text-brand-700'
        : 'border-gray-200 text-gray-700 hover:border-gray-300';
      const thumb = styleThumbs[s.value] || styleThumbs.graphics;
      return `<button type="button" data-value="${s.value}"
        class="poster-bg-btn relative px-3 py-3 rounded-lg border-2 text-xs font-medium text-center transition ${cls}">
        ${POSTER_NEW_VALUES.has(s.value) ? '<span class="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-bold uppercase tracking-wider">New</span>' : ''}
        <img src="${thumb}" class="w-10 h-10 mx-auto mb-1 rounded object-cover" alt="${escHtml(s.label)}"/>${escHtml(s.label)}
      </button>`;
    }).join('');
    bgGrid.querySelectorAll('.poster-bg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        posterSelectedBgStyle = btn.dataset.value;
        renderBgGrid();
      });
    });
  };
  renderBgGrid();

  // Clear overrides
  document.getElementById('poster-prompt').value = '';
  document.getElementById('poster-headline').value = '';
  document.getElementById('poster-subtext').value = '';
  document.getElementById('poster-tagline').value = '';

  document.getElementById('modal-poster').classList.remove('hidden');
  lucide.createIcons();
}

// ==================== POSTER IDEAS ====================
async function generatePosterIdeas() {
  const btn = document.getElementById('btn-poster-ideas');
  const list = document.getElementById('poster-ideas-list');
  const occasion = document.getElementById('poster-occasion')?.value || 'custom';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Thinking...'; }
  list.innerHTML = '';
  list.classList.remove('hidden');
  try {
    const res = await api('/api/poster-ideas', { method: 'POST', body: { occasion } });
    if (res.error) throw new Error(res.error);
    const ideas = res.ideas || [];
    if (!ideas.length) { list.innerHTML = '<p class="text-xs text-gray-400">No ideas generated. Try again.</p>'; return; }
    list.innerHTML = ideas.map((idea, i) => `
      <button type="button" onclick="pickPosterIdea(this)" data-brief="${escHtml(idea.brief)}"
        class="w-full text-left p-2.5 rounded-lg border border-gray-150 hover:border-brand-400 hover:bg-brand-50/50 transition group">
        <p class="text-xs font-semibold text-gray-700 group-hover:text-brand-700">${escHtml(idea.title)}</p>
        <p class="text-[11px] text-gray-500 mt-0.5 leading-relaxed">${escHtml(idea.brief)}</p>
      </button>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="text-xs text-red-500">Failed to generate ideas. Try again.</p>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="lightbulb" class="w-3.5 h-3.5"></i> Give me ideas'; }
    lucide.createIcons();
  }
}

function pickPosterIdea(el) {
  const brief = el.dataset.brief || '';
  const textarea = document.getElementById('poster-prompt');
  if (textarea) textarea.value = brief;
  document.getElementById('poster-ideas-list').classList.add('hidden');
}

// ==================== REFERENCE IMAGE ====================
let _posterRefFile = null;

function onRefImageSelected(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Image must be under 10 MB', 'error'); return; }
  _posterRefFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('poster-ref-thumb').src = e.target.result;
    document.getElementById('poster-ref-name').textContent = file.name;
    document.getElementById('poster-ref-placeholder').classList.add('hidden');
    document.getElementById('poster-ref-preview').classList.remove('hidden');
    document.getElementById('poster-ref-actions').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearRefImage() {
  _posterRefFile = null;
  document.getElementById('poster-ref-input').value = '';
  document.getElementById('poster-ref-placeholder').classList.remove('hidden');
  document.getElementById('poster-ref-preview').classList.add('hidden');
  document.getElementById('poster-ref-actions').classList.add('hidden');
}

async function submitPosterGenerate() {
  const fd = new FormData();
  fd.append('occasion', document.getElementById('poster-occasion').value);
  fd.append('customPrompt', document.getElementById('poster-prompt').value.trim());
  fd.append('backgroundStyle', posterSelectedBgStyle);
  fd.append('size', posterSelectedSize);
  fd.append('language', posterSelectedLanguage);
  fd.append('template', posterSelectedLayout || 'auto');
  fd.append('headline', document.getElementById('poster-headline').value.trim());
  fd.append('subtext', document.getElementById('poster-subtext').value.trim());
  fd.append('tagline', document.getElementById('poster-tagline').value.trim());
  if (_posterRefFile) fd.append('referenceImage', _posterRefFile);

  showPosterGenerating();

  try {
    const res = await fetch(`${API}/api/posters/generate`, { method: 'POST', body: fd });
    const result = await res.json();
    if (result.error) throw new Error(result.error);
    hidePosterGenerating();
    closeModal('modal-poster');
    clearRefImage();
    fireConfetti();
    showToast('Poster created!', 'success');
    loadPosters();
    openPosterPreview(result.poster.id, result.poster);
  } catch (err) {
    hidePosterGenerating();
    showToast(err.message || 'Failed to generate poster', 'error');
  }
}

// Celebration burst fired when a poster finishes generating. Uses
// canvas-confetti (loaded via CDN) and degrades silently if the library
// failed to load.
function fireConfetti() {
  if (typeof confetti !== 'function') return;
  const tlbColors = ['#30B0A4', '#A8E2DB', '#6DCEC5', '#207B74', '#FFFFFF'];
  const defaults = { zIndex: 9999, colors: tlbColors, disableForReducedMotion: true };

  // Quick central burst
  confetti({ ...defaults, particleCount: 90, spread: 80, origin: { y: 0.6 } });
  // Side cannons for extra flair
  setTimeout(() => {
    confetti({ ...defaults, particleCount: 60, angle: 60,  spread: 70, origin: { x: 0, y: 0.7 } });
    confetti({ ...defaults, particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }, 180);
}

async function openPosterPreview(id, preloaded) {
  const poster = preloaded || await api(`/api/posters/${id}`);
  if (poster.error) return showToast(poster.error, 'error');
  currentPreviewPoster = poster;
  setupPhoneticForPreview(poster.language);
  populateCaptionSection(poster);
  populatePublishSection(poster);
  cancelEditTextMode(); // always open in view mode
  document.getElementById('poster-preview-img').src = poster.image_url + '?t=' + Date.now();
  const occasionLabel = (posterOptions?.occasions.find(o => o.value === poster.occasion)?.label) || poster.occasion;
  const sizeLabel = (posterOptions?.sizes.find(s => s.value === poster.size)?.label) || poster.size;
  const langLabel = (posterOptions?.languages.find(l => l.value === poster.language)?.label) || poster.language;
  document.getElementById('poster-preview-meta').innerHTML = `
    <div class="flex flex-wrap gap-2 mb-2">
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-600">${escHtml(occasionLabel)}</span>
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">${escHtml(sizeLabel)}</span>
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">${escHtml(langLabel)}</span>
      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">${poster.width}×${poster.height}</span>
    </div>
    <p class="text-sm font-semibold text-gray-800">${escHtml(poster.headline || '')}</p>
    <p class="text-xs text-gray-500 mt-1">${escHtml(poster.subtext || '')}</p>
  `;
  document.getElementById('modal-poster-preview').classList.remove('hidden');
  lucide.createIcons();
}

// ==================== SOCIAL MEDIA CAPTION ====================
async function generatePosterCaption() {
  if (!currentPreviewPoster) return;
  const id = currentPreviewPoster.id;
  const btn = document.getElementById('btn-generate-caption');
  const regenBtn = document.getElementById('btn-regen-caption');
  const area = document.getElementById('poster-caption-area');
  const result = document.getElementById('poster-caption-result');
  const titleEl = document.getElementById('poster-caption-title');
  const textEl = document.getElementById('poster-caption-text');
  const hashEl = document.getElementById('poster-caption-hashtags');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating...'; }
  if (regenBtn) { regenBtn.disabled = true; }

  try {
    const res = await api(`/api/posters/${id}/generate-caption`, { method: 'POST' });
    if (res.error) throw new Error(res.error);
    const data = res.caption;
    if (typeof data === 'object') {
      titleEl.value = data.title || '';
      textEl.value = data.caption || '';
      hashEl.value = data.hashtags || '';
    } else {
      // Fallback for plain string response
      titleEl.value = '';
      textEl.value = data || '';
      hashEl.value = '';
    }
    area.classList.add('hidden');
    result.classList.remove('hidden');
  } catch (err) {
    showToast(err.message || 'Caption generation failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> Generate Caption & Hashtags';
    }
    if (regenBtn) { regenBtn.disabled = false; }
    lucide.createIcons();
  }
}

function copyPosterCaption() {
  const titleEl = document.getElementById('poster-caption-title');
  const textEl = document.getElementById('poster-caption-text');
  const hashEl = document.getElementById('poster-caption-hashtags');
  const parts = [titleEl?.value, textEl?.value, hashEl?.value].filter(Boolean);
  const full = parts.join('\n\n');
  if (!full) return;
  navigator.clipboard.writeText(full).then(() => {
    const btn = document.getElementById('btn-copy-caption');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Copied!';
      btn.classList.add('text-green-600');
      lucide.createIcons();
      setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('text-green-600'); lucide.createIcons(); }, 2000);
    }
  }).catch(() => {
    textEl.select();
    showToast('Press Ctrl+C to copy', 'info');
  });
}

function resetCaptionSection() {
  const area = document.getElementById('poster-caption-area');
  const result = document.getElementById('poster-caption-result');
  if (area) area.classList.remove('hidden');
  if (result) result.classList.add('hidden');
}

async function savePosterCaption() {
  if (!currentPreviewPoster) return;
  const title = (document.getElementById('poster-caption-title')?.value || '').trim();
  const caption = (document.getElementById('poster-caption-text')?.value || '').trim();
  const hashtags = (document.getElementById('poster-caption-hashtags')?.value || '').trim();
  await api(`/api/posters/${currentPreviewPoster.id}/caption`, {
    method: 'PATCH', body: { title, caption, hashtags }
  });
  // Update local cache
  currentPreviewPoster.caption_title = title;
  currentPreviewPoster.caption_text = caption;
  currentPreviewPoster.caption_hashtags = hashtags;
}

function populateCaptionSection(poster) {
  const area = document.getElementById('poster-caption-area');
  const result = document.getElementById('poster-caption-result');
  const titleEl = document.getElementById('poster-caption-title');
  const textEl = document.getElementById('poster-caption-text');
  const hashEl = document.getElementById('poster-caption-hashtags');
  if (poster.caption_title || poster.caption_text || poster.caption_hashtags) {
    titleEl.value = poster.caption_title || '';
    textEl.value = poster.caption_text || '';
    hashEl.value = poster.caption_hashtags || '';
    area.classList.add('hidden');
    result.classList.remove('hidden');
  } else {
    titleEl.value = '';
    textEl.value = '';
    hashEl.value = '';
    area.classList.remove('hidden');
    result.classList.add('hidden');
  }
}

function populatePublishSection(poster) {
  const statusEl = document.getElementById('poster-publish-status');
  const formEl = document.getElementById('poster-publish-form');
  const linksEl = document.getElementById('poster-publish-links');
  const dateEl = document.getElementById('poster-publish-date');
  // Reset checkboxes
  document.getElementById('publish-instagram').checked = false;
  document.getElementById('publish-facebook').checked = false;
  document.getElementById('publish-linkedin').checked = false;

  let platforms = [];
  try { platforms = JSON.parse(poster.published_platforms || '[]'); } catch {}
  let links = {};
  try { links = JSON.parse(poster.published_link || '{}'); } catch {
    // Backward compat: old single-link format
    if (typeof poster.published_link === 'string' && poster.published_link && !poster.published_link.startsWith('{')) {
      platforms.forEach(p => { links[p] = poster.published_link; });
    }
  }

  if (poster.published_at && platforms.length) {
    // Show published status
    statusEl.classList.remove('hidden');
    formEl.classList.add('hidden');
    dateEl.textContent = timeAgo(poster.published_at);
    const colors = { instagram: 'bg-pink-50 text-pink-700 border-pink-100', facebook: 'bg-blue-50 text-blue-700 border-blue-100', linkedin: 'bg-sky-50 text-sky-700 border-sky-100' };
    const icons = { instagram: 'instagram', facebook: 'facebook', linkedin: 'linkedin' };
    linksEl.innerHTML = platforms.map(p => {
      const url = links[p] || '';
      const shortUrl = url.length > 45 ? url.slice(0, 45) + '...' : url;
      return `<div class="flex items-center gap-2 p-2 rounded-lg ${colors[p] || 'bg-gray-50 text-gray-600 border-gray-100'} border text-xs">
        <span class="font-medium capitalize flex-shrink-0">${escHtml(p)}</span>
        ${url ? `<a href="${escHtml(url)}" target="_blank" class="truncate hover:underline flex items-center gap-1"><i data-lucide="external-link" class="w-3 h-3 flex-shrink-0"></i>${escHtml(shortUrl)}</a>` : '<span class="text-gray-400">No link</span>'}
      </div>`;
    }).join('');
    // Pre-fill form for editing
    platforms.forEach(p => {
      const cb = document.getElementById('publish-' + p);
      if (cb) cb.checked = true;
    });
    _publishLinks = { ...links };
    onPublishPlatformToggle();
    // Fill link values after inputs are rendered
    platforms.forEach(p => {
      const inp = document.getElementById('publish-link-' + p);
      if (inp && links[p]) inp.value = links[p];
    });
  } else {
    statusEl.classList.add('hidden');
    formEl.classList.remove('hidden');
    _publishLinks = {};
    onPublishPlatformToggle();
  }
  lucide.createIcons();
}

let _publishLinks = {};

function onPublishPlatformToggle() {
  const container = document.getElementById('publish-links-inputs');
  const btn = document.getElementById('btn-mark-published');
  const platformIds = ['instagram', 'facebook', 'linkedin'];
  const checked = platformIds.filter(p => document.getElementById('publish-' + p)?.checked);
  // Save current input values before re-rendering
  platformIds.forEach(p => {
    const inp = document.getElementById('publish-link-' + p);
    if (inp) _publishLinks[p] = inp.value;
  });
  const labels = { instagram: 'Instagram post URL', facebook: 'Facebook post URL', linkedin: 'LinkedIn post URL' };
  const placeholders = { instagram: 'https://instagram.com/p/...', facebook: 'https://facebook.com/...', linkedin: 'https://linkedin.com/posts/...' };
  container.innerHTML = checked.map(p => `
    <div>
      <label class="block text-[11px] text-gray-500 mb-1">${labels[p]}</label>
      <input type="url" id="publish-link-${p}" placeholder="${placeholders[p]}" value="${escHtml(_publishLinks[p] || '')}"
        class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200">
    </div>
  `).join('');
  if (checked.length) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function togglePublishForm(show) {
  document.getElementById('poster-publish-status').classList.toggle('hidden', show);
  document.getElementById('poster-publish-form').classList.toggle('hidden', !show);
}

async function markPosterPublished() {
  if (!currentPreviewPoster) return;
  const platformIds = ['instagram', 'facebook', 'linkedin'];
  const platforms = platformIds.filter(p => document.getElementById('publish-' + p)?.checked);
  if (!platforms.length) return showToast('Select at least one platform', 'error');
  const links = {};
  const missing = [];
  platforms.forEach(p => {
    const val = (document.getElementById('publish-link-' + p)?.value || '').trim();
    if (val) links[p] = val; else missing.push(p);
  });
  if (missing.length) return showToast('Enter the post URL for: ' + missing.join(', '), 'error');
  const btn = document.getElementById('btn-mark-published');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...'; }
  try {
    const res = await api(`/api/posters/${currentPreviewPoster.id}/publish`, {
      method: 'PATCH', body: { platforms, links }
    });
    if (res.error) throw new Error(res.error);
    currentPreviewPoster = res.poster;
    populatePublishSection(res.poster);
    showToast('Marked as published', 'success');
    loadPosters(); // refresh gallery badges
  } catch (err) {
    showToast(err.message || 'Failed to update', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Mark as Published'; }
    lucide.createIcons();
  }
}

async function regenerateCurrentPoster() {
  if (!currentPreviewPoster) return;
  await regeneratePoster(currentPreviewPoster.id);
}

async function regeneratePoster(id) {
  if (!confirm('Regenerate this poster with the same settings? A new background and copy will be created.')) return;
  const btn = document.getElementById('btn-poster-regen');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Regenerating...'; }
  showToast('Regenerating... 20-40s', 'info');
  try {
    // Only send empty headline/subtext/tagline so AI regenerates copy
    const result = await api(`/api/posters/${id}/regenerate`, {
      method: 'POST',
      body: { headline: '', subtext: '', tagline: '' }
    });
    if (result.error) throw new Error(result.error);
    showToast('Poster regenerated', 'success');
    loadPosters();
    if (currentPreviewPoster && currentPreviewPoster.id === id) {
      openPosterPreview(id, result.poster);
    }
  } catch (err) {
    showToast(err.message || 'Regenerate failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Regenerate'; }
    lucide.createIcons();
  }
}

async function deletePoster(id) {
  if (!confirm('Delete this poster permanently?')) return;
  try {
    const result = await api(`/api/posters/${id}`, { method: 'DELETE' });
    if (result.error) throw new Error(result.error);
    showToast('Poster deleted', 'success');
    loadPosters();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function downloadPoster(id) {
  const poster = await api(`/api/posters/${id}`);
  if (poster.error) return showToast(poster.error, 'error');
  triggerImageDownload(poster.image_url, `tlb-poster-${id}.png`);
}

function downloadCurrentPoster() {
  if (!currentPreviewPoster) return;
  triggerImageDownload(currentPreviewPoster.image_url, `tlb-poster-${currentPreviewPoster.id}.png`);
}

// ==================== PHONETIC INPUT (Google Input Tools) ====================
// Deshkeyboard-style typing for Odia/Kannada poster fields. User types
// English phonetically (e.g. "namaste") and picks the correct native word
// from a suggestion dropdown. Powered by Google Input Tools, the same
// public endpoint Google's own tools use. No library, no build cost.
const PHONETIC_ITC = { odia: 'or-t-i0-und', kannada: 'kn-t-i0-und' };
const PHONETIC_FIELDS = ['edit-poster-headline', 'edit-poster-subtext', 'edit-poster-tagline'];

const phoneticState = {
  input: null,
  wordStart: 0,
  wordEnd: 0,
  suggestions: [],
  highlighted: 0,
  requestId: 0
};
let phoneticDropdownEl = null;
let phoneticDebounceTimer = null;

function ensurePhoneticDropdown() {
  if (phoneticDropdownEl) return phoneticDropdownEl;
  phoneticDropdownEl = document.createElement('div');
  phoneticDropdownEl.id = 'phonetic-dropdown';
  phoneticDropdownEl.className = 'hidden fixed z-[60] bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm';
  phoneticDropdownEl.style.minWidth = '200px';
  phoneticDropdownEl.addEventListener('mousedown', (e) => {
    // Prevent input from losing focus when clicking inside the dropdown
    e.preventDefault();
  });
  document.body.appendChild(phoneticDropdownEl);
  return phoneticDropdownEl;
}

function hidePhoneticDropdown() {
  if (phoneticDropdownEl) phoneticDropdownEl.classList.add('hidden');
  phoneticState.input = null;
  phoneticState.suggestions = [];
}

function renderPhoneticDropdown() {
  const dd = ensurePhoneticDropdown();
  const { input, suggestions, highlighted } = phoneticState;
  if (!input || !suggestions.length) {
    dd.classList.add('hidden');
    return;
  }
  dd.innerHTML = suggestions.map((s, i) => `
    <div class="phonetic-item flex items-center px-3 py-1.5 cursor-pointer ${i === highlighted ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50'}" data-index="${i}">
      <span class="text-[10px] text-gray-400 mr-2 w-3 text-right">${i + 1}</span>
      <span class="flex-1">${escHtml(s)}</span>
    </div>
  `).join('');
  const rect = input.getBoundingClientRect();
  dd.style.left = rect.left + 'px';
  dd.style.top = (rect.bottom + 4) + 'px';
  dd.style.minWidth = Math.max(rect.width, 200) + 'px';
  dd.classList.remove('hidden');
  dd.querySelectorAll('.phonetic-item').forEach(item => {
    item.onclick = () => {
      phoneticState.highlighted = Number(item.dataset.index);
      commitPhoneticSuggestion();
      input.focus();
    };
  });
}

function getCurrentWordBounds(input) {
  const val = input.value;
  const caret = input.selectionStart || 0;
  let start = caret;
  while (start > 0 && /[A-Za-z]/.test(val[start - 1])) start--;
  let end = caret;
  while (end < val.length && /[A-Za-z]/.test(val[end])) end++;
  return { start, end, word: val.slice(start, end) };
}

// Google Input Tools does NOT send an Access-Control-Allow-Origin header,
// so a plain fetch() is blocked by CORS. It does support JSONP via `&cb=`,
// which is what we use here. Each call injects a <script> tag, runs a
// single-use callback, and cleans up after itself.
let phoneticCallbackSeq = 0;
function fetchPhoneticSuggestions(word, itc) {
  return new Promise((resolve) => {
    const cbName = `__phoneticCb${++phoneticCallbackSeq}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      resolve([]);
    }, 3500);

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (data) => {
      cleanup();
      if (!Array.isArray(data) || data[0] !== 'SUCCESS') return resolve([]);
      const entry = data[1] && data[1][0];
      resolve((entry && entry[1]) || []);
    };

    script.onerror = () => { cleanup(); resolve([]); };
    script.src =
      `https://inputtools.google.com/request?text=${encodeURIComponent(word)}` +
      `&itc=${itc}&num=6&cp=0&cs=1&ie=utf-8&oe=utf-8&cb=${cbName}`;
    document.head.appendChild(script);
  });
}

function schedulePhoneticLookup(input, itc) {
  clearTimeout(phoneticDebounceTimer);
  const { start, end, word } = getCurrentWordBounds(input);
  if (!word) { hidePhoneticDropdown(); return; }
  phoneticState.input = input;
  phoneticState.wordStart = start;
  phoneticState.wordEnd = end;
  const reqId = ++phoneticState.requestId;
  phoneticDebounceTimer = setTimeout(async () => {
    try {
      const suggestions = await fetchPhoneticSuggestions(word, itc);
      if (reqId !== phoneticState.requestId) return; // stale
      // Keep the raw English word as the last fallback option so the user
      // can always bail out to literal ASCII.
      phoneticState.suggestions = suggestions.length ? [...suggestions, word] : [];
      phoneticState.highlighted = 0;
      renderPhoneticDropdown();
    } catch {
      hidePhoneticDropdown();
    }
  }, 180);
}

function commitPhoneticSuggestion() {
  const { input, suggestions, highlighted, wordStart, wordEnd } = phoneticState;
  if (!input || !suggestions.length) return false;
  const pick = suggestions[highlighted];
  const val = input.value;
  input.value = val.slice(0, wordStart) + pick + val.slice(wordEnd);
  const newCaret = wordStart + pick.length;
  input.setSelectionRange(newCaret, newCaret);
  hidePhoneticDropdown();
  return true;
}

function attachPhoneticInput(input, language) {
  const itc = PHONETIC_ITC[language];
  if (!itc) return;

  input.addEventListener('input', () => schedulePhoneticLookup(input, itc));
  input.addEventListener('click', () => schedulePhoneticLookup(input, itc));
  input.addEventListener('keydown', (e) => {
    if (phoneticState.input !== input || !phoneticState.suggestions.length) return;
    const len = phoneticState.suggestions.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        phoneticState.highlighted = (phoneticState.highlighted + 1) % len;
        renderPhoneticDropdown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        phoneticState.highlighted = (phoneticState.highlighted - 1 + len) % len;
        renderPhoneticDropdown();
        break;
      case 'Enter':
      case 'Tab':
        if (commitPhoneticSuggestion()) e.preventDefault();
        break;
      case ' ': {
        // Commit then insert the space manually (and swallow the keypress)
        if (commitPhoneticSuggestion()) {
          e.preventDefault();
          const caret = input.selectionStart;
          input.value = input.value.slice(0, caret) + ' ' + input.value.slice(caret);
          input.setSelectionRange(caret + 1, caret + 1);
        }
        break;
      }
      case 'Escape':
        e.preventDefault();
        hidePhoneticDropdown();
        break;
      default:
        if (/^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (idx < len) {
            phoneticState.highlighted = idx;
            if (commitPhoneticSuggestion()) e.preventDefault();
          }
        }
    }
  });
  input.addEventListener('blur', () => {
    // Delay so dropdown mousedown (preventDefault) can still commit
    setTimeout(() => {
      if (phoneticState.input === input) hidePhoneticDropdown();
    }, 120);
  });
}

// Re-arm phonetic typing for the three edit fields whenever a new poster
// preview is opened. Cloning each element is the cleanest way to drop any
// previously-attached listeners without bookkeeping.
function setupPhoneticForPreview(language) {
  const supported = language === 'odia' || language === 'kannada';
  PHONETIC_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(false);
    clone.value = el.value;
    el.parentNode.replaceChild(clone, el);
    if (supported) attachPhoneticInput(clone, language);
  });
  const banner = document.getElementById('edit-poster-phonetic-info');
  if (banner) {
    banner.classList.toggle('hidden', !supported);
    if (supported) {
      const langLabel = language === 'odia' ? 'Odia' : 'Kannada';
      const title = document.getElementById('edit-poster-phonetic-title');
      if (title) title.textContent = `Type in English, pick ${langLabel}`;
    }
  }
  hidePhoneticDropdown();
}

// ==================== EDIT POSTER TEXT (no bg regen) ====================
function setPreviewMode(mode) {
  // mode: 'view' or 'edit' — toggle the `hidden` Tailwind class so the
  // companion display class (flex / block) on each element takes over.
  document.querySelectorAll('#modal-poster-preview .js-view-mode').forEach(el => {
    el.classList.toggle('hidden', mode !== 'view');
  });
  document.querySelectorAll('#modal-poster-preview .js-edit-mode').forEach(el => {
    el.classList.toggle('hidden', mode !== 'edit');
  });
}

// Mirror of the layout size ratios in services/poster-generator.js. Kept in
// sync so the edit form can show the current effective font sizes in px.
function computeDefaultFontSizes({ width, height, template, size }) {
  const base = Math.min(width, height);
  const isLandscape = width > height;
  // YouTube size forces the youtube-thumb layout regardless of template value.
  let t = size === 'youtube' ? 'youtube-thumb' : (template || 'center-classic');
  if (t === 'auto') t = 'center-classic';

  switch (t) {
    case 'bottom-left':
      return {
        headline: Math.round(base * (isLandscape ? 0.13 : 0.095)),
        subtext:  Math.round(base * 0.032),
        tagline:  Math.round(base * 0.025)
      };
    case 'top-hero':
      return {
        headline: Math.round(base * (isLandscape ? 0.14 : 0.11)),
        subtext:  Math.round(base * 0.032),
        tagline:  Math.round(base * 0.025)
      };
    case 'minimal-center':
      return {
        headline: Math.round(base * (isLandscape ? 0.18 : 0.14)),
        subtext:  Math.round(base * 0.028),
        tagline:  0
      };
    case 'youtube-thumb':
      return {
        headline: Math.round(base * 0.13),
        subtext:  Math.round(base * 0.045),
        tagline:  0
      };
    case 'center-classic':
    default:
      return {
        headline: Math.round(base * (isLandscape ? 0.14 : 0.10)),
        subtext:  Math.round(base * 0.034),
        tagline:  Math.round(base * 0.028)
      };
  }
}

// Mirror of the gap ratios in services/poster-generator.js so the edit form
// shows the current effective spacing for each layout.
function computeDefaultSpacing({ width, height, template, size }) {
  const base = Math.min(width, height);
  let t = size === 'youtube' ? 'youtube-thumb' : (template || 'center-classic');
  if (t === 'auto') t = 'center-classic';

  switch (t) {
    case 'center-classic':
      return { headlineSubtext: Math.round(base * 0.025), headlineTagline: Math.round(base * 0.025) };
    case 'bottom-left':
      return { headlineSubtext: Math.round(base * 0.025), headlineTagline: Math.round(base * 0.022) };
    case 'top-hero':
      return { headlineSubtext: Math.round(base * 0.03),  headlineTagline: Math.round(base * 0.025) };
    case 'minimal-center':
      return { headlineSubtext: Math.round(base * 0.028), headlineTagline: 0 };
    case 'youtube-thumb':
      return { headlineSubtext: Math.round(base * 0.03),  headlineTagline: 0 };
    default:
      return { headlineSubtext: Math.round(base * 0.025), headlineTagline: Math.round(base * 0.025) };
  }
}

// Re-fill spacing inputs for the current layout. Follows the same pattern
// as refreshEditFontSizes: prefer saved override, fall back to computed
// defaults, and disable headlineTagline when the layout skips the tagline.
function refreshEditSpacing() {
  if (!currentPreviewPoster) return;
  const p = currentPreviewPoster;
  const template = document.getElementById('edit-poster-layout').value || p.template || 'auto';

  let savedSpacing = {};
  if (p.spacing) {
    try { savedSpacing = JSON.parse(p.spacing) || {}; } catch {}
  }

  const defaults = computeDefaultSpacing({
    width: p.width, height: p.height, template, size: p.size
  });

  const hsEl = document.getElementById('edit-poster-spacing-hs');
  const htEl = document.getElementById('edit-poster-spacing-ht');

  hsEl.value = savedSpacing.headlineSubtext || defaults.headlineSubtext || '';
  htEl.value = savedSpacing.headlineTagline || defaults.headlineTagline || '';

  const taglineUsed = defaults.headlineTagline > 0;
  htEl.disabled = !taglineUsed;
  htEl.placeholder = taglineUsed ? 'auto' : 'n/a';
}

// Re-fill the font size inputs based on the currently selected layout. Called
// when the edit form opens and whenever the layout dropdown changes.
function refreshEditFontSizes() {
  if (!currentPreviewPoster) return;
  const p = currentPreviewPoster;
  const template = document.getElementById('edit-poster-layout').value || p.template || 'auto';

  let savedSizes = {};
  if (p.font_sizes) {
    try { savedSizes = JSON.parse(p.font_sizes) || {}; } catch {}
  }

  const defaults = computeDefaultFontSizes({
    width: p.width, height: p.height, template, size: p.size
  });

  // Prefer saved override, fall back to computed default. Tagline = 0 means
  // "not used in this layout" — show empty rather than 0.
  const headEl = document.getElementById('edit-poster-headline-size');
  const subEl  = document.getElementById('edit-poster-subtext-size');
  const tagEl  = document.getElementById('edit-poster-tagline-size');

  headEl.value = savedSizes.headline || defaults.headline || '';
  subEl.value  = savedSizes.subtext  || defaults.subtext  || '';
  tagEl.value  = savedSizes.tagline  || defaults.tagline  || '';

  // Disable tagline input when the current layout doesn't render it.
  const taglineUsed = defaults.tagline > 0;
  tagEl.disabled = !taglineUsed;
  tagEl.placeholder = taglineUsed ? 'auto' : 'n/a';
}

function enterEditTextMode() {
  if (!currentPreviewPoster) return;
  const p = currentPreviewPoster;

  document.getElementById('edit-poster-headline').value = p.headline || '';
  document.getElementById('edit-poster-subtext').value = p.subtext || '';
  document.getElementById('edit-poster-tagline').value = p.tagline || '';

  // Populate layout dropdown
  const layoutSel = document.getElementById('edit-poster-layout');
  const layouts = (posterOptions && posterOptions.layouts) || [{ value: 'auto', label: 'Auto / Surprise me' }];
  layoutSel.innerHTML = layouts.map(l => `<option value="${l.value}">${escHtml(l.label)}</option>`).join('');
  layoutSel.value = p.template || 'auto';
  // Recompute font sizes and spacing whenever the user switches layout.
  layoutSel.onchange = () => { refreshEditFontSizes(); refreshEditSpacing(); };

  // Pre-fill font size and spacing inputs with the current effective values
  refreshEditFontSizes();
  refreshEditSpacing();

  // Show / hide the "needs regenerate first" notice for legacy posters
  const notice = document.getElementById('edit-poster-legacy-notice');
  if (notice) notice.classList.toggle('hidden', Boolean(p.background_url));

  setPreviewMode('edit');
  lucide.createIcons();
}

function cancelEditTextMode() {
  setPreviewMode('view');
}

async function saveEditedText() {
  if (!currentPreviewPoster) return;
  const id = currentPreviewPoster.id;
  const btn = document.getElementById('btn-save-edit-text');

  // Collect font size overrides. Only include non-empty positive values; the
  // server will clamp them to a sane range. An empty object means "clear".
  const fontSizes = {};
  const hSize = Number(document.getElementById('edit-poster-headline-size').value);
  const sSize = Number(document.getElementById('edit-poster-subtext-size').value);
  const tSize = Number(document.getElementById('edit-poster-tagline-size').value);
  if (Number.isFinite(hSize) && hSize > 0) fontSizes.headline = hSize;
  if (Number.isFinite(sSize) && sSize > 0) fontSizes.subtext  = sSize;
  if (Number.isFinite(tSize) && tSize > 0) fontSizes.tagline  = tSize;

  // Collect spacing overrides (same pattern as font sizes)
  const spacing = {};
  const hsVal = Number(document.getElementById('edit-poster-spacing-hs').value);
  const htVal = Number(document.getElementById('edit-poster-spacing-ht').value);
  if (Number.isFinite(hsVal) && hsVal > 0) spacing.headlineSubtext = hsVal;
  if (Number.isFinite(htVal) && htVal > 0) spacing.headlineTagline = htVal;

  const payload = {
    headline: document.getElementById('edit-poster-headline').value.trim(),
    subtext: document.getElementById('edit-poster-subtext').value.trim(),
    tagline: document.getElementById('edit-poster-tagline').value.trim(),
    template: document.getElementById('edit-poster-layout').value || 'auto',
    fontSizes,
    spacing
  };
  if (!payload.headline) return showToast('Headline cannot be empty', 'error');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Saving...'; }
  try {
    const result = await api(`/api/posters/${id}/edit-text`, { method: 'POST', body: payload });
    if (result.error) throw new Error(result.error);
    showToast('Poster updated', 'success');
    loadPosters();
    openPosterPreview(id, result.poster); // refreshes image + meta + back to view mode
  } catch (err) {
    showToast(err.message || 'Save failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Save Changes'; }
    lucide.createIcons();
  }
}

async function triggerImageDownload(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

// ==================== BODY SCROLL LOCK FOR MODALS ====================
// Lock the page scroll whenever any full-screen modal is visible. Only true
// top-level modal divs (class "fixed inset-0 ... z-50") qualify — inner
// helper containers like #modal-article-preview are intentionally excluded.
const MODAL_SELECTOR = 'div.fixed.inset-0.z-50[id^="modal-"]';

function syncBodyScrollLock() {
  const anyOpen = Array.from(document.querySelectorAll(MODAL_SELECTOR))
    .some(el => !el.classList.contains('hidden'));
  document.body.style.overflow = anyOpen ? 'hidden' : '';
}

function watchModalsForScrollLock() {
  const modals = document.querySelectorAll(MODAL_SELECTOR);
  const obs = new MutationObserver(syncBodyScrollLock);
  modals.forEach(m => obs.observe(m, { attributes: true, attributeFilter: ['class'] }));
  syncBodyScrollLock();
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  const initialPage = PATH_TO_PAGE[window.location.pathname] || 'home';
  navigate(initialPage, { fromPop: true });
  // Make sure history state has a page so back button works
  history.replaceState({ page: initialPage }, '', PAGE_TO_PATH[initialPage] || '/');
  watchModalsForScrollLock();
});
