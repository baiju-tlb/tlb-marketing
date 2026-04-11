require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
// const nodemailer = require('nodemailer');

const db = require('./services/database');
const { scrapeAll } = require('./services/news-scraper');
const { generatePost, generateImagePrompt, generateImage, generateArticle, generateCoverImagePrompt, condenseArticleForPost, POST_TYPES, ARTICLE_TYPES } = require('./services/content-generator');
const posterGenerator = require('./services/poster-generator');
const linkedin = require('./services/linkedin');
const { startScheduler } = require('./services/scheduler');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// ==================== AUTH ====================
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'tlbamar';
const sessionStore = new Map(); // token -> { email, expires }

function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessionStore.set(token, { email, expires });
  return token;
}

function isAuthenticated(req) {
  const token = req.cookies?.tlb_session;
  if (!token) return false;
  const session = sessionStore.get(token);
  if (!session) return false;
  if (Date.now() > session.expires) {
    sessionStore.delete(token);
    return false;
  }
  return true;
}

function authMiddleware(req, res, next) {
  // Public routes
  if (req.path === '/login' || req.path === '/login.html' ||
      req.path.startsWith('/api/auth/') ||
      req.path.startsWith('/auth/linkedin')) {
    return next();
  }
  // Static assets
  if (req.path.match(/\.(css|js|png|jpg|ico|svg|woff|woff2)$/)) {
    return next();
  }
  if (!isAuthenticated(req)) {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.redirect('/login');
  }
  next();
}

// Serve login page
app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Login with email + password
app.post('/api/auth/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = (req.body.password || '');

  if (!ALLOWED_EMAILS.includes(email)) {
    return res.status(403).json({ error: 'This email is not authorized.' });
  }

  if (password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const token = createSession(email);

  res.cookie('tlb_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({ success: true });
});

// Check auth status
app.get('/api/auth/me', (req, res) => {
  const token = req.cookies?.tlb_session;
  if (!token) return res.json({ authenticated: false });
  const session = sessionStore.get(token);
  if (!session || Date.now() > session.expires) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, email: session.email });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.tlb_session;
  if (token) sessionStore.delete(token);
  res.clearCookie('tlb_session');
  res.json({ success: true });
});

// Apply auth middleware AFTER auth routes but BEFORE everything else
app.use(authMiddleware);

// Serve dashboard (protected)
app.use(express.static('public'));

// SPA fallback for client-side routes (e.g. /post-creation, /dashboard, etc.)
const SPA_ROUTES = ['/dashboard', '/news', '/posts', '/articles', '/post-creation', '/calendar', '/settings'];
SPA_ROUTES.forEach(route => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// ==================== ARTICLES ====================

app.get('/api/articles', (req, res) => {
  const { status, region, category, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM articles WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (region) { query += ' AND region = ?'; params.push(region); }
  if (category) { query += ' AND category = ?'; params.push(category); }

  query += ' ORDER BY scraped_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  let articles = db.prepare(query).all(...params);
  articles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
  const total = db.prepare('SELECT COUNT(*) as count FROM articles').get().count;
  res.json({ articles, total });
});

app.post('/api/articles/scrape', async (req, res) => {
  try {
    const count = await scrapeAll();
    res.json({ success: true, newArticles: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/articles/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE articles SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

// ==================== POSTS ====================

app.get('/api/posts', (req, res) => {
  const { status, limit = 50 } = req.query;
  let query = `SELECT p.*, a.title as article_title, a.region, a.source
               FROM posts p LEFT JOIN articles a ON p.article_id = a.id WHERE 1=1`;
  const params = [];

  if (status) { query += ' AND p.status = ?'; params.push(status); }
  query += ' ORDER BY p.created_at DESC LIMIT ?';
  params.push(Number(limit));

  const posts = db.prepare(query).all(...params);
  res.json({ posts });
});

app.post('/api/posts/generate', async (req, res) => {
  const { articleId, postType = 'news_commentary' } = req.body;

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  try {
    const content = await generatePost(article, postType);
    const imagePrompt = await generateImagePrompt(article, content);

    const result = db.prepare(`
      INSERT INTO posts (article_id, content, image_prompt, post_type, status)
      VALUES (?, ?, ?, ?, 'draft')
    `).run(article.id, content, imagePrompt, postType);

    db.prepare('UPDATE articles SET status = ? WHERE id = ?').run('used', article.id);

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/:id/generate-image', async (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  try {
    const imagePrompt = req.body.imagePrompt || post.image_prompt;
    const imageUrl = await generateImage(imagePrompt);

    if (imageUrl) {
      db.prepare("UPDATE posts SET image_url = ?, image_prompt = ?, updated_at = datetime('now') WHERE id = ?")
        .run(imageUrl, imagePrompt, post.id);
    }

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Image generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/posts/:id', (req, res) => {
  const { content, status, scheduled_at, image_prompt, image_url } = req.body;
  const updates = [];
  const params = [];

  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (scheduled_at !== undefined) { updates.push('scheduled_at = ?'); params.push(scheduled_at); }
  if (image_prompt !== undefined) { updates.push('image_prompt = ?'); params.push(image_prompt); }
  if (image_url !== undefined) { updates.push('image_url = ?'); params.push(image_url || null); }

  if (updates.length === 0) return res.json({ success: true });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json({ success: true, post });
});

app.delete('/api/posts/:id', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/posts/:id/regenerate', async (req, res) => {
  const post = db.prepare('SELECT p.*, a.* FROM posts p JOIN articles a ON p.article_id = a.id WHERE p.id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  try {
    const postType = req.body.postType || post.post_type;
    const content = await generatePost(post, postType);
    const imagePrompt = await generateImagePrompt(post, content);

    db.prepare("UPDATE posts SET content = ?, image_prompt = ?, post_type = ?, updated_at = datetime('now') WHERE id = ?")
      .run(content, imagePrompt, postType, req.params.id);

    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    res.json({ success: true, post: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SCHEDULE POST ====================

app.post('/api/posts/:id/schedule', (req, res) => {
  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required' });

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.prepare("UPDATE posts SET status = 'scheduled', scheduled_at = ?, updated_at = datetime('now') WHERE id = ?")
    .run(scheduled_at, req.params.id);

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json({ success: true, post: updated });
});

// Publish post immediately
app.post('/api/posts/:id/publish', async (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_access_token'").get();
  if (!tokenRow || !tokenRow.value) {
    return res.status(400).json({ error: 'LinkedIn not connected. Please connect your account first.' });
  }

  try {
    const subRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_user_sub'").get();
    const personSub = subRow?.value || null;
    const result = await linkedin.publishPost(tokenRow.value, post.content, post.image_url || null, personSub);

    db.prepare("UPDATE posts SET status = 'published', published_at = datetime('now'), linkedin_post_id = ? WHERE id = ?")
      .run(result.postId || '', post.id);

    const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    res.json({ success: true, post: updated, linkedinPostId: result.postId });
  } catch (err) {
    console.error('LinkedIn publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get scheduled posts (for calendar)
app.get('/api/posts/scheduled', (req, res) => {
  const posts = db.prepare(`
    SELECT p.*, a.title as article_title, a.region
    FROM posts p LEFT JOIN articles a ON p.article_id = a.id
    WHERE p.status = 'scheduled' OR p.status = 'published'
    ORDER BY COALESCE(p.scheduled_at, p.published_at) ASC
  `).all();
  res.json({ posts });
});

// ==================== LINKEDIN ARTICLES ====================

app.get('/api/linkedin-articles', (req, res) => {
  const { status, limit = 20, offset = 0 } = req.query;
  let query = `SELECT la.*, a.title as source_title, a.region as source_region
    FROM linkedin_articles la LEFT JOIN articles a ON la.source_article_id = a.id WHERE 1=1`;
  const params = [];
  if (status) { query += ' AND la.status = ?'; params.push(status); }
  query += ' ORDER BY la.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const articles = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as c FROM linkedin_articles').get().c;
  res.json({ articles, total });
});

app.get('/api/linkedin-articles/:id', (req, res) => {
  const article = db.prepare(`SELECT la.*, a.title as source_title, a.region as source_region
    FROM linkedin_articles la LEFT JOIN articles a ON la.source_article_id = a.id
    WHERE la.id = ?`).get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

app.post('/api/linkedin-articles/generate', async (req, res) => {
  const { articleId, topic, articleType = 'educational' } = req.body;

  try {
    let source = {};
    if (articleId) {
      const newsArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
      if (!newsArticle) return res.status(404).json({ error: 'Source article not found' });
      source = { articleId: newsArticle.id, title: newsArticle.title, summary: newsArticle.summary, source: newsArticle.source, region: newsArticle.region };
    } else if (topic) {
      source = { topic };
    } else {
      return res.status(400).json({ error: 'Provide articleId or topic' });
    }

    const result = await generateArticle(source, articleType);

    // Also generate cover image prompt
    let coverImagePrompt = '';
    try {
      coverImagePrompt = await generateCoverImagePrompt(result.title, articleType);
    } catch (e) {
      console.error('Cover image prompt generation failed:', e.message);
    }

    const insert = db.prepare(`INSERT INTO linkedin_articles (title, subtitle, content, cover_image_prompt, source_article_id, source_topic, article_type)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const info = insert.run(result.title, result.subtitle, result.content, coverImagePrompt, articleId || null, topic || null, articleType);

    // Mark source article as used
    if (articleId) {
      db.prepare("UPDATE articles SET status = 'used' WHERE id = ?").run(articleId);
    }

    const created = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, article: created });
  } catch (err) {
    console.error('Article generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/linkedin-articles/:id/regenerate', async (req, res) => {
  const article = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  try {
    let source = {};
    if (article.source_article_id) {
      const newsArticle = db.prepare('SELECT * FROM articles WHERE id = ?').get(article.source_article_id);
      if (newsArticle) {
        source = { articleId: newsArticle.id, title: newsArticle.title, summary: newsArticle.summary, source: newsArticle.source, region: newsArticle.region };
      }
    }
    if (!source.articleId && article.source_topic) {
      source = { topic: article.source_topic };
    }
    if (!source.articleId && !source.topic) {
      source = { topic: article.title };
    }

    const result = await generateArticle(source, article.article_type);
    db.prepare("UPDATE linkedin_articles SET title = ?, subtitle = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
      .run(result.title, result.subtitle, result.content, article.id);

    const updated = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(article.id);
    res.json({ success: true, article: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/linkedin-articles/:id', (req, res) => {
  const { title, subtitle, content, status, cover_image_prompt } = req.body;
  const article = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const updates = [];
  const params = [];
  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (subtitle !== undefined) { updates.push('subtitle = ?'); params.push(subtitle); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (cover_image_prompt !== undefined) { updates.push('cover_image_prompt = ?'); params.push(cover_image_prompt); }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE linkedin_articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(req.params.id);
  res.json({ success: true, article: updated });
});

app.post('/api/linkedin-articles/:id/generate-cover', async (req, res) => {
  const article = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  try {
    const imagePrompt = req.body.imagePrompt || article.cover_image_prompt;
    if (!imagePrompt) return res.status(400).json({ error: 'No image prompt provided' });

    const imageUrl = await generateImage(imagePrompt);
    db.prepare("UPDATE linkedin_articles SET cover_image = ?, cover_image_prompt = ?, updated_at = datetime('now') WHERE id = ?")
      .run(imageUrl, imagePrompt, article.id);

    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Cover image generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/linkedin-articles/:id/publish', async (req, res) => {
  const article = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Article not found' });

  const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_access_token'").get();
  if (!tokenRow || !tokenRow.value) {
    return res.status(400).json({ error: 'LinkedIn not connected. Please connect your account first.' });
  }

  try {
    // Generate a condensed post version of the article
    const postContent = await condenseArticleForPost(article.title, article.content);

    const subRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_user_sub'").get();
    const personSub = subRow?.value || null;

    // Publish with cover image if available
    const result = await linkedin.publishPost(tokenRow.value, postContent, article.cover_image || null, personSub);

    db.prepare("UPDATE linkedin_articles SET status = 'published', published_at = datetime('now'), linkedin_article_url = ? WHERE id = ?")
      .run(result.postId || '', article.id);

    const updated = db.prepare('SELECT * FROM linkedin_articles WHERE id = ?').get(article.id);
    res.json({ success: true, article: updated, postId: result.postId });
  } catch (err) {
    console.error('Article publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/linkedin-articles/:id', (req, res) => {
  db.prepare('DELETE FROM linkedin_articles WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/article-types', (req, res) => {
  const types = Object.entries(ARTICLE_TYPES).map(([key, val]) => ({
    value: key,
    label: val.label
  }));
  res.json(types);
});

// ==================== LINKEDIN OAUTH (Multi-user) ====================

app.get('/api/linkedin/status', async (req, res) => {
  const users = db.prepare('SELECT id, linkedin_sub, name, token_expires, role, is_active, last_login FROM users WHERE is_active = 1').all();
  const activeUserRow = db.prepare("SELECT value FROM settings WHERE key = 'active_linkedin_user'").get();
  const activeUserId = activeUserRow ? Number(activeUserRow.value) : null;

  // Check org access using active user's token
  let hasOrgAccess = false;
  if (activeUserId) {
    const activeUser = db.prepare('SELECT access_token FROM users WHERE id = ?').get(activeUserId);
    if (activeUser?.access_token) {
      try { hasOrgAccess = await linkedin.checkOrgAccess(activeUser.access_token); } catch {}
    }
  }

  res.json({
    connected: users.length > 0,
    users: users.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      expires: u.token_expires,
      isActive: u.id === activeUserId,
      lastLogin: u.last_login
    })),
    activeUserId,
    hasOrgAccess,
    companyId: process.env.LINKEDIN_COMPANY_ID || null,
    postingAs: hasOrgAccess ? 'Company Page (The Land Bank)' : 'Personal Profile'
  });
});

app.post('/api/linkedin/set-active', (req, res) => {
  const { userId } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_linkedin_user', ?)").run(String(userId));
  // Also update legacy settings for backward compatibility with scheduler
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('linkedin_access_token', ?)").run(user.access_token);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('linkedin_user_sub', ?)").run(user.linkedin_sub || '');
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('linkedin_user_name', ?)").run(user.name);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('linkedin_token_expires', ?)").run(user.token_expires || '');
  res.json({ success: true });
});

app.post('/api/linkedin/remove-user', (req, res) => {
  const { userId } = req.body;
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  // If this was the active user, clear active
  const activeRow = db.prepare("SELECT value FROM settings WHERE key = 'active_linkedin_user'").get();
  if (activeRow && Number(activeRow.value) === userId) {
    db.prepare("DELETE FROM settings WHERE key = 'active_linkedin_user'").run();
    // Set another user as active if available
    const nextUser = db.prepare('SELECT id FROM users WHERE is_active = 1 LIMIT 1').get();
    if (nextUser) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('active_linkedin_user', ?)").run(String(nextUser.id));
    }
  }
  res.json({ success: true });
});

app.get('/auth/linkedin', (req, res) => {
  const includeOrgScope = req.query.org === '1';
  const { url, state } = linkedin.getAuthUrl(includeOrgScope);
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  upsert.run('linkedin_oauth_state', state);
  res.redirect(url);
});

app.get('/auth/linkedin/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.send(`<html><body><h2>LinkedIn Authorization Failed</h2><p>${error}</p><p>${req.query.error_description || ''}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`);
  }

  try {
    const tokenData = await linkedin.getAccessToken(code);

    let userName = 'Connected';
    let userSub = '';

    if (tokenData.id_token) {
      try {
        const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString());
        userSub = payload.sub || '';
        userName = payload.name || payload.given_name || 'Connected';
      } catch (e) {
        console.error('Failed to decode id_token:', e.message);
      }
    }

    if (!userSub) {
      try {
        const profile = await linkedin.getProfile(tokenData.access_token);
        userSub = profile.sub || '';
        userName = profile.name || userName;
      } catch (e) {}
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Upsert user by linkedin_sub
    const existingUser = userSub ? db.prepare('SELECT id FROM users WHERE linkedin_sub = ?').get(userSub) : null;

    let userId;
    if (existingUser) {
      db.prepare("UPDATE users SET name = ?, access_token = ?, refresh_token = ?, token_expires = ?, last_login = datetime('now') WHERE id = ?")
        .run(userName, tokenData.access_token, tokenData.refresh_token || null, expiresAt, existingUser.id);
      userId = existingUser.id;
    } else {
      const info = db.prepare('INSERT INTO users (linkedin_sub, name, access_token, refresh_token, token_expires) VALUES (?, ?, ?, ?, ?)')
        .run(userSub, userName, tokenData.access_token, tokenData.refresh_token || null, expiresAt);
      userId = info.lastInsertRowid;
    }

    // Set as active user
    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    upsert.run('active_linkedin_user', String(userId));
    upsert.run('linkedin_access_token', tokenData.access_token);
    upsert.run('linkedin_user_sub', userSub);
    upsert.run('linkedin_user_name', userName);
    upsert.run('linkedin_token_expires', expiresAt);

    console.log(`LinkedIn connected: ${userName} (user #${userId})`);

    res.send(`
      <html>
      <body style="font-family: 'DM Sans', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
        <div style="text-align: center;">
          <div style="width: 64px; height: 64px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="color: #1e293b; margin-bottom: 8px;">Welcome, ${userName}!</h2>
          <p style="color: #64748b;">LinkedIn connected. You can close this window.</p>
          <script>setTimeout(() => window.close(), 2000)</script>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('LinkedIn callback error:', err.message);
    res.send(`<html><body><h2>Error</h2><p>${err.message}</p></body></html>`);
  }
});

app.post('/api/linkedin/disconnect', (req, res) => {
  db.prepare('DELETE FROM users').run();
  db.prepare("DELETE FROM settings WHERE key LIKE 'linkedin_%' OR key = 'active_linkedin_user'").run();
  res.json({ success: true });
});

// ==================== SETTINGS ====================

app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => {
    // Don't expose tokens to frontend
    if (r.key.includes('token') || r.key.includes('secret')) return;
    settings[r.key] = r.value;
  });
  res.json(settings);
});

app.patch('/api/settings', (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(req.body)) {
    upsert.run(key, String(value));
  }
  res.json({ success: true });
});

// ==================== DASHBOARD STATS ====================

app.get('/api/stats', (req, res) => {
  const totalArticles = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  const newArticles = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status = 'new'").get().c;
  const totalPosts = db.prepare('SELECT COUNT(*) as c FROM posts').get().c;
  const drafts = db.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'draft'").get().c;
  const approved = db.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'approved'").get().c;
  const published = db.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'published'").get().c;
  const scheduled = db.prepare("SELECT COUNT(*) as c FROM posts WHERE status = 'scheduled'").get().c;

  const totalLinkedinArticles = db.prepare('SELECT COUNT(*) as c FROM linkedin_articles').get().c;
  const draftLinkedinArticles = db.prepare("SELECT COUNT(*) as c FROM linkedin_articles WHERE status = 'draft'").get().c;
  const publishedLinkedinArticles = db.prepare("SELECT COUNT(*) as c FROM linkedin_articles WHERE status = 'published'").get().c;

  res.json({ totalArticles, newArticles, totalPosts, drafts, approved, published, scheduled, totalLinkedinArticles, draftLinkedinArticles, publishedLinkedinArticles });
});

// ==================== POSTERS ====================

// Use env var for persistent disk on Render; fallback to public/posters locally
const POSTERS_DIR = process.env.POSTERS_DIR || path.join(__dirname, 'public', 'posters');
fs.mkdirSync(POSTERS_DIR, { recursive: true });
// Serve posters from the actual directory (which may be outside public/ in prod)
app.use('/posters', express.static(POSTERS_DIR));

// Clamp font size overrides to a sane range and drop empty values. Returns
// an object suitable for passing to recomposePoster, or null if nothing to apply.
function sanitizeFontSizes(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of ['headline', 'subtext', 'tagline']) {
    const v = Number(raw[key]);
    if (Number.isFinite(v) && v > 0) {
      out[key] = Math.max(8, Math.min(400, Math.round(v)));
    }
  }
  return Object.keys(out).length ? out : null;
}

app.get('/api/poster-options', (req, res) => {
  res.json({
    occasions: Object.entries(posterGenerator.OCCASIONS).map(([key, val]) => ({ value: key, label: val.label })),
    languages: Object.entries(posterGenerator.LANGUAGES).map(([key, val]) => ({ value: key, label: val.label })),
    sizes: Object.entries(posterGenerator.SIZES).map(([key, val]) => ({ value: key, label: val.label, width: val.width, height: val.height })),
    backgroundStyles: Object.entries(posterGenerator.BG_STYLES).map(([key, val]) => ({ value: key, label: val.label })),
    layouts: posterGenerator.LAYOUTS
  });
});

app.get('/api/posters', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const posters = db.prepare('SELECT * FROM posters ORDER BY created_at DESC LIMIT ? OFFSET ?').all(Number(limit), Number(offset));
  const total = db.prepare('SELECT COUNT(*) as c FROM posters').get().c;
  res.json({ posters, total });
});

app.get('/api/posters/:id', (req, res) => {
  const poster = db.prepare('SELECT * FROM posters WHERE id = ?').get(req.params.id);
  if (!poster) return res.status(404).json({ error: 'Poster not found' });
  res.json(poster);
});

app.post('/api/posters/generate', async (req, res) => {
  const { occasion, customPrompt, backgroundStyle, size, language, headline, subtext, tagline, template, fontSizes } = req.body;

  // Store the user's *intent* (e.g. 'auto' or 'top-hero') so that a poster
  // generated with Auto re-randomises on regenerate while a locked one stays
  // locked. The resolved template is returned in the response for debugging.
  const templateIntent = template || 'auto';
  const fontSizeOverrides = sanitizeFontSizes(fontSizes);

  try {
    const result = await posterGenerator.generatePoster({
      occasion, customPrompt, backgroundStyle, size, language, headline, subtext, tagline,
      template: templateIntent,
      fontSizeOverrides
    });

    // Save final image + raw background. The background is kept so users
    // can later edit just the text without re-running Gemini.
    const stem = `poster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${stem}.png`;
    fs.writeFileSync(path.join(POSTERS_DIR, filename), result.buffer);
    const imageUrl = `/posters/${filename}`;

    const bgFilename = `${stem}-bg.png`;
    fs.writeFileSync(path.join(POSTERS_DIR, bgFilename), result.backgroundBuffer);
    const backgroundUrl = `/posters/${bgFilename}`;

    const info = db.prepare(`
      INSERT INTO posters (occasion, custom_prompt, background_style, size, language, headline, subtext, tagline, image_url, width, height, template, background_url, font_sizes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      occasion || 'custom',
      customPrompt || '',
      backgroundStyle || 'graphics',
      size || 'square',
      language || 'english',
      result.copy.headline,
      result.copy.subtext,
      result.copy.tagline,
      imageUrl,
      result.size.width,
      result.size.height,
      templateIntent,
      backgroundUrl,
      fontSizeOverrides ? JSON.stringify(fontSizeOverrides) : null
    );

    const poster = db.prepare('SELECT * FROM posters WHERE id = ?').get(info.lastInsertRowid);
    res.json({ success: true, poster });
  } catch (err) {
    console.error('Poster generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posters/:id/regenerate', async (req, res) => {
  const poster = db.prepare('SELECT * FROM posters WHERE id = ?').get(req.params.id);
  if (!poster) return res.status(404).json({ error: 'Poster not found' });

  try {
    // Use overrides from body if provided, else fall back to stored values.
    // For `template` specifically, callers can pass 'auto' to force a new
    // random pick on regenerate even if the poster was previously saved with
    // a specific template.
    const opts = {
      occasion: req.body.occasion ?? poster.occasion,
      customPrompt: req.body.customPrompt ?? poster.custom_prompt,
      backgroundStyle: req.body.backgroundStyle ?? poster.background_style,
      size: req.body.size ?? poster.size,
      language: req.body.language ?? poster.language,
      headline: req.body.headline ?? poster.headline,
      subtext: req.body.subtext ?? poster.subtext,
      tagline: req.body.tagline ?? poster.tagline,
      template: req.body.template ?? poster.template
    };

    // Legacy: older posters used background_style='colorful' as a palette hint.
    // The modern model drops that style and lets the user brief drive palette,
    // so translate it on the fly for any legacy row regenerated from scratch.
    if (opts.backgroundStyle === 'colorful') {
      opts.backgroundStyle = 'graphics';
      const hint = 'vibrant saturated festive colours, rich editorial palette';
      opts.customPrompt = opts.customPrompt ? `${opts.customPrompt}. ${hint}` : hint;
    }

    const result = await posterGenerator.generatePoster(opts);

    // Remove old final and background files
    if (poster.image_url) {
      const oldName = path.basename(poster.image_url);
      try { fs.unlinkSync(path.join(POSTERS_DIR, oldName)); } catch {}
    }
    if (poster.background_url) {
      const oldBg = path.basename(poster.background_url);
      try { fs.unlinkSync(path.join(POSTERS_DIR, oldBg)); } catch {}
    }

    const stem = `poster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${stem}.png`;
    fs.writeFileSync(path.join(POSTERS_DIR, filename), result.buffer);
    const imageUrl = `/posters/${filename}`;

    const bgFilename = `${stem}-bg.png`;
    fs.writeFileSync(path.join(POSTERS_DIR, bgFilename), result.backgroundBuffer);
    const backgroundUrl = `/posters/${bgFilename}`;

    db.prepare(`
      UPDATE posters SET
        occasion = ?, custom_prompt = ?, background_style = ?, size = ?, language = ?,
        headline = ?, subtext = ?, tagline = ?, image_url = ?, width = ?, height = ?,
        template = ?, background_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      opts.occasion, opts.customPrompt, opts.backgroundStyle, opts.size, opts.language,
      result.copy.headline, result.copy.subtext, result.copy.tagline,
      imageUrl, result.size.width, result.size.height,
      opts.template || 'auto', backgroundUrl, poster.id
    );

    const updated = db.prepare('SELECT * FROM posters WHERE id = ?').get(poster.id);
    res.json({ success: true, poster: updated });
  } catch (err) {
    console.error('Poster regenerate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Re-render just the text (and optionally the layout/language) on top of the
// previously saved background. Fast (no Gemini calls) and used by the inline
// "Edit Text" mode in the preview modal.
app.post('/api/posters/:id/edit-text', async (req, res) => {
  const poster = db.prepare('SELECT * FROM posters WHERE id = ?').get(req.params.id);
  if (!poster) return res.status(404).json({ error: 'Poster not found' });
  if (!poster.background_url) {
    return res.status(400).json({
      error: 'This poster was created before text editing was supported. Regenerate it once to enable text editing.'
    });
  }

  const bgPath = path.join(POSTERS_DIR, path.basename(poster.background_url));
  if (!fs.existsSync(bgPath)) {
    return res.status(400).json({ error: 'Background file is missing on disk. Regenerate this poster.' });
  }

  try {
    // Merge font size overrides: prefer the caller's values, fall back to any
    // previously-saved overrides on the poster. If the caller passes an empty
    // object we interpret that as "clear overrides".
    let fontSizeOverrides;
    if (Object.prototype.hasOwnProperty.call(req.body, 'fontSizes')) {
      fontSizeOverrides = sanitizeFontSizes(req.body.fontSizes);
    } else if (poster.font_sizes) {
      try { fontSizeOverrides = sanitizeFontSizes(JSON.parse(poster.font_sizes)); } catch {}
    }

    const result = await posterGenerator.recomposePoster({
      background: bgPath,
      headline: req.body.headline ?? poster.headline,
      subtext: req.body.subtext ?? poster.subtext,
      tagline: req.body.tagline ?? poster.tagline,
      template: req.body.template ?? poster.template,
      language: req.body.language ?? poster.language,
      size: poster.size,
      fontSizeOverrides
    });

    // Write the new final image under a new filename so the browser doesn't
    // serve a stale cached copy. The background file stays as-is.
    const stem = `poster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const filename = `${stem}.png`;
    fs.writeFileSync(path.join(POSTERS_DIR, filename), result.buffer);
    const imageUrl = `/posters/${filename}`;

    if (poster.image_url) {
      const oldName = path.basename(poster.image_url);
      try { fs.unlinkSync(path.join(POSTERS_DIR, oldName)); } catch {}
    }

    const newTemplate = req.body.template ?? poster.template;
    const newLanguage = req.body.language ?? poster.language;

    db.prepare(`
      UPDATE posters SET
        headline = ?, subtext = ?, tagline = ?, template = ?, language = ?,
        image_url = ?, font_sizes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      result.copy.headline, result.copy.subtext, result.copy.tagline,
      newTemplate, newLanguage, imageUrl,
      fontSizeOverrides ? JSON.stringify(fontSizeOverrides) : null,
      poster.id
    );

    const updated = db.prepare('SELECT * FROM posters WHERE id = ?').get(poster.id);
    res.json({ success: true, poster: updated });
  } catch (err) {
    console.error('Poster edit-text error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/posters/:id', (req, res) => {
  const poster = db.prepare('SELECT * FROM posters WHERE id = ?').get(req.params.id);
  if (!poster) return res.status(404).json({ error: 'Poster not found' });
  if (poster.image_url) {
    const name = path.basename(poster.image_url);
    try { fs.unlinkSync(path.join(POSTERS_DIR, name)); } catch {}
  }
  if (poster.background_url) {
    const bgName = path.basename(poster.background_url);
    try { fs.unlinkSync(path.join(POSTERS_DIR, bgName)); } catch {}
  }
  db.prepare('DELETE FROM posters WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/post-types', (req, res) => {
  const types = Object.entries(POST_TYPES).map(([key, val]) => ({
    value: key,
    label: val.label
  }));
  res.json(types);
});

// ==================== CRON JOBS ====================

cron.schedule('0 */6 * * *', async () => {
  console.log('[CRON] Scraping news...');
  try {
    const count = await scrapeAll();
    console.log(`[CRON] Scraped ${count} new articles`);
  } catch (err) {
    console.error('[CRON] Scrape failed:', err.message);
  }
});

// ==================== START ====================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`TLB Marketing Dashboard running on http://localhost:${PORT}`);
  startScheduler();
});
