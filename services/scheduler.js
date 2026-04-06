const cron = require('node-cron');
const db = require('./database');
const { publishPost } = require('./linkedin');

let schedulerJob = null;

// Check every minute for posts that need to be published
function startScheduler() {
  if (schedulerJob) schedulerJob.stop();

  schedulerJob = cron.schedule('* * * * *', async () => {
    const now = new Date().toISOString();

    // Find approved posts that are scheduled for now or earlier
    const posts = db.prepare(`
      SELECT * FROM posts
      WHERE status = 'scheduled'
      AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `).all(now);

    if (posts.length === 0) return;

    // Get LinkedIn token
    const tokenRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_access_token'").get();
    if (!tokenRow || !tokenRow.value) {
      console.log('[SCHEDULER] No LinkedIn token found. Skipping scheduled posts.');
      return;
    }

    const accessToken = tokenRow.value;
    const subRow = db.prepare("SELECT value FROM settings WHERE key = 'linkedin_user_sub'").get();
    const personSub = subRow?.value || null;

    for (const post of posts) {
      try {
        console.log(`[SCHEDULER] Publishing post ${post.id}...`);
        const result = await publishPost(accessToken, post.content, post.image_url || null, personSub);

        db.prepare("UPDATE posts SET status = 'published', published_at = datetime('now'), linkedin_post_id = ? WHERE id = ?")
          .run(result.postId || '', post.id);

        console.log(`[SCHEDULER] Post ${post.id} published! LinkedIn ID: ${result.postId}`);
      } catch (err) {
        console.error(`[SCHEDULER] Failed to publish post ${post.id}:`, err.message);
        // Mark as failed so it doesn't retry endlessly
        db.prepare("UPDATE posts SET status = 'failed', updated_at = datetime('now') WHERE id = ?")
          .run(post.id);
      }
    }
  });

  console.log('[SCHEDULER] Post scheduler started (checking every minute)');
}

function stopScheduler() {
  if (schedulerJob) {
    schedulerJob.stop();
    schedulerJob = null;
    console.log('[SCHEDULER] Post scheduler stopped');
  }
}

module.exports = { startScheduler, stopScheduler };
