const RSSParser = require('rss-parser');
const db = require('./database');

const parser = new RSSParser();

// Tightly scoped Google News RSS feeds - land/property only
const FEEDS = [
  // Odisha
  {
    url: 'https://news.google.com/rss/search?q=%22land+acquisition%22+Odisha+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'odisha', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=%22land+record%22+OR+%22land+registration%22+OR+%22property+registration%22+Odisha+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'odisha', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=%22land+reform%22+OR+%22land+dispute%22+OR+%22land+scam%22+OR+%22land+grab%22+Odisha+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'odisha', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=RERA+Odisha+OR+%22real+estate%22+Odisha+OR+%22plot+sale%22+Odisha+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'odisha', category: 'property'
  },
  // Karnataka
  {
    url: 'https://news.google.com/rss/search?q=%22land+acquisition%22+OR+%22land+record%22+OR+%22land+dispute%22+Karnataka+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'karnataka', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=%22property+registration%22+OR+%22land+registration%22+OR+Kaveri+OR+Bhoomi+Karnataka+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'karnataka', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=RERA+Karnataka+OR+%22real+estate%22+Bangalore+OR+%22land+price%22+Karnataka+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'karnataka', category: 'property'
  },
  // National
  {
    url: 'https://news.google.com/rss/search?q=%22land+acquisition%22+India+OR+%22land+reform%22+India+OR+%22digital+land+records%22+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'national', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=%22property+registration%22+India+OR+%22land+digitization%22+OR+%22land+title%22+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'national', category: 'land'
  },
  {
    url: 'https://news.google.com/rss/search?q=%22land+banking%22+OR+%22proptech%22+India+OR+RERA+India+when:3d&hl=en-IN&gl=IN&ceid=IN:en',
    region: 'national', category: 'land_banking'
  }
];

// Keywords that MUST appear in title/summary for an article to be relevant
const RELEVANT_KEYWORDS = [
  'land', 'property', 'real estate', 'rera', 'plot', 'acre',
  'registration', 'mutation', 'revenue', 'cadastral', 'survey',
  'title deed', 'encumbrance', 'stamp duty', 'circle rate',
  'fair value', 'guideline value', 'acquisition', 'proptech',
  'land bank', 'land record', 'bhoomi', 'kaveri', 'bhulekh',
  'patta', 'khata', 'khatiyan', 'mouza', 'tehsil',
  'realty', 'housing', 'builder', 'developer', 'dlf', 'prestige',
  'godrej properties', 'sobha', 'brigade', 'residential',
  'commercial land', 'industrial land', 'sez', 'township'
];

// Keywords that indicate NOT land-related (false positives)
const EXCLUDE_KEYWORDS = [
  'cricket land', 'landslide', 'landing', 'landed role',
  'disneyland', 'iceland', 'la la land', 'motherland',
  'homeland', 'dreamland', 'no man\'s land', 'promised land',
  'land rover', 'land cruiser', 'farmland festival'
];

function isRelevant(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();

  // Check exclusions first
  for (const ex of EXCLUDE_KEYWORDS) {
    if (text.includes(ex)) return false;
  }

  // Must match at least one relevant keyword
  for (const kw of RELEVANT_KEYWORDS) {
    if (text.includes(kw)) return true;
  }

  return false;
}

const insertArticle = db.prepare(`
  INSERT OR IGNORE INTO articles (title, summary, source, url, region, category, published_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const MAX_AGE_DAYS = 7;

async function scrapeAll() {
  let totalNew = 0;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);

  for (const feed of FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      for (const item of result.items || []) {
        const link = item.link || '';
        const title = (item.title || '').replace(/ - .*$/, '').trim();
        const summary = item.contentSnippet || item.content || '';
        const source = item.creator || item.source?.name || extractSource(item.title);
        const pubDate = item.pubDate || item.isoDate || new Date().toISOString();

        // Skip old articles
        const articleDate = new Date(pubDate);
        if (articleDate < cutoff) continue;

        // Skip irrelevant articles
        if (!isRelevant(title, summary)) continue;

        try {
          const info = insertArticle.run(title, summary, source, link, feed.region, feed.category, pubDate);
          if (info.changes > 0) totalNew++;
        } catch (e) {
          // Duplicate URL, skip
        }
      }
    } catch (err) {
      console.error(`Failed to fetch feed for ${feed.region}/${feed.category}:`, err.message);
    }
  }

  console.log(`Scraped ${totalNew} new articles`);
  return totalNew;
}

function extractSource(title) {
  if (!title) return 'Unknown';
  const match = title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : 'Unknown';
}

if (require.main === module) {
  scrapeAll().then(count => {
    console.log(`Done. ${count} new articles added.`);
    process.exit(0);
  });
}

module.exports = { scrapeAll, FEEDS };
