const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'marketing.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT,
    url TEXT UNIQUE,
    region TEXT,
    category TEXT,
    published_at TEXT,
    scraped_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'new',
    relevance_score INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER,
    content TEXT NOT NULL,
    image_prompt TEXT,
    image_url TEXT,
    post_type TEXT DEFAULT 'news_commentary',
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    published_at TEXT,
    linkedin_post_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id)
  );

  CREATE TABLE IF NOT EXISTS post_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    checked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS ai_cost_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    amount_inr REAL NOT NULL,
    poster_id INTEGER,
    user_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_sub TEXT UNIQUE,
    name TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires TEXT,
    role TEXT DEFAULT 'admin',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occasion TEXT,
    custom_prompt TEXT,
    background_style TEXT,
    size TEXT,
    language TEXT,
    headline TEXT,
    subtext TEXT,
    tagline TEXT,
    image_url TEXT,
    width INTEGER,
    height INTEGER,
    status TEXT DEFAULT 'ready',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS linkedin_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    cover_image_prompt TEXT,
    source_article_id INTEGER,
    source_topic TEXT,
    article_type TEXT DEFAULT 'educational',
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT,
    published_at TEXT,
    linkedin_article_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_article_id) REFERENCES articles(id)
  );
`);

// ---- Lightweight migrations ----
// Add new columns on existing databases. Each ALTER is wrapped in try/catch
// because better-sqlite3 throws if the column already exists.
function addColumnIfMissing(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (e) {
    if (!/duplicate column/i.test(e.message)) throw e;
  }
}
addColumnIfMissing('posters', 'template', 'TEXT');
addColumnIfMissing('posters', 'background_url', 'TEXT');
addColumnIfMissing('posters', 'font_sizes', 'TEXT'); // JSON: { headline, subtext, tagline }
addColumnIfMissing('posters', 'spacing', 'TEXT');    // JSON: { headlineSubtext, headlineTagline }
addColumnIfMissing('posters', 'caption_title', 'TEXT');
addColumnIfMissing('posters', 'caption_text', 'TEXT');
addColumnIfMissing('posters', 'caption_hashtags', 'TEXT');
addColumnIfMissing('ai_cost_log', 'user_email', 'TEXT');
addColumnIfMissing('posters', 'published_platforms', 'TEXT'); // JSON array: ["instagram","facebook"]
addColumnIfMissing('posters', 'published_link', 'TEXT');
addColumnIfMissing('posters', 'published_at', 'TEXT');

// Insert default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('post_frequency', '3');
insertSetting.run('auto_approve', 'false');
insertSetting.run('tone', 'professional');
insertSetting.run('regions', 'odisha,karnataka,national');
insertSetting.run('post_types', 'news_commentary,educational,industry_insight,product_highlight');
insertSetting.run('ai_cost_inr', '0');

// One-time backfill: estimate cost for existing posters created before tracking
(function backfillAiCost() {
  const logCount = db.prepare('SELECT COUNT(*) as c FROM ai_cost_log').get().c;
  if (logCount === 0) {
    const posters = db.prepare('SELECT id, created_at FROM posters ORDER BY created_at ASC').all();
    if (posters.length > 0) {
      const ins = db.prepare('INSERT INTO ai_cost_log (action, amount_inr, poster_id, created_at) VALUES (?, ?, ?, ?)');
      const batch = db.transaction(() => {
        for (const p of posters) {
          ins.run('Poster Generated', 3.5, p.id, p.created_at);
        }
      });
      batch();
      const estimated = (posters.length * 3.5).toFixed(2);
      db.prepare("UPDATE settings SET value = ? WHERE key = 'ai_cost_inr'").run(estimated);
    }
  }
})();

module.exports = db;
