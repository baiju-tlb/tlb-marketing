require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const POST_TYPES = {
  news_commentary: {
    label: 'News Commentary',
    prompt: `You are the social media manager for "The Land Bank" (TLB), a proptech platform that simplifies land records, due diligence, and land banking in India.

Write a detailed, engaging LinkedIn post commenting on this news article. The post MUST be 250-350 words long. Structure it like this:

1. HOOK: Start with a compelling question or bold statement (1-2 lines)
2. CONTEXT: Explain the news and its significance in 4-5 lines
3. ANALYSIS: Share TLB's perspective on what this means for landowners, investors, and the real estate ecosystem (4-5 lines)
4. INSIGHT: Add a unique observation, statistic, or forward-looking point (2-3 lines)
5. CTA: End with a thought-provoking question or call-to-action that encourages engagement (1-2 lines)
6. HASHTAGS: Include 5-7 relevant hashtags on a new line

Important rules:
- Use line breaks between sections for readability
- Use bullet points or numbered lists where appropriate
- Professional but conversational tone
- Do NOT use em dashes or en dashes anywhere (use commas or periods instead)
- Do NOT use the word "crucial"
- Make it feel like a real thought leader wrote it, not AI`
  },
  educational: {
    label: 'Educational',
    prompt: `You are the social media manager for "The Land Bank" (TLB), a proptech platform that simplifies land records, due diligence, and land banking in India.

Write a detailed, educational LinkedIn post inspired by this news/topic. The post MUST be 250-350 words long. Structure it like this:

1. HOOK: Start with "Did you know..." or a surprising fact (1-2 lines)
2. EXPLAIN: Break down the concept in simple terms that a first-time land buyer would understand (5-6 lines)
3. PRACTICAL TIPS: Give 3-4 actionable tips or steps related to this topic
4. TLB CONNECTION: Explain how The Land Bank helps simplify this process (2-3 lines)
5. CTA: Encourage readers to share their experience or ask questions (1-2 lines)
6. HASHTAGS: Include 5-7 relevant hashtags on a new line

Important rules:
- Use line breaks between sections for readability
- Use bullet points or numbered lists for the tips
- Simple, jargon-free language
- Do NOT use em dashes or en dashes anywhere (use commas or periods instead)
- Do NOT use the word "crucial"
- Make it genuinely helpful and informative`
  },
  industry_insight: {
    label: 'Industry Insight',
    prompt: `You are the social media manager for "The Land Bank" (TLB), a proptech platform that simplifies land records, due diligence, and land banking in India.

Write a detailed thought leadership LinkedIn post based on this news/trend. The post MUST be 250-350 words long. Structure it like this:

1. HOOK: Start with a bold prediction or contrarian take (1-2 lines)
2. TREND ANALYSIS: Discuss the broader trend in Indian real estate or land digitization (4-5 lines)
3. DATA/EVIDENCE: Reference relevant statistics, government initiatives, or market shifts (3-4 lines)
4. VISION: Share where this is heading in the next 2-5 years (3-4 lines)
5. TLB's ROLE: Position TLB as part of this transformation (2-3 lines)
6. CTA: Ask a forward-looking question to spark discussion (1-2 lines)
7. HASHTAGS: Include 5-7 relevant hashtags on a new line

Important rules:
- Use line breaks between sections for readability
- Authoritative, visionary tone
- Do NOT use em dashes or en dashes anywhere (use commas or periods instead)
- Do NOT use the word "crucial"
- Sound like a real industry expert, not AI`
  },
  product_highlight: {
    label: 'Product Highlight',
    prompt: `You are the social media manager for "The Land Bank" (TLB), a proptech platform that simplifies land records, due diligence, and land banking in India.

Write a detailed LinkedIn post that highlights TLB's value in the context of this news. The post MUST be 250-350 words long. Structure it like this:

1. HOOK: Start with a relatable pain point or frustration about land records/property (1-2 lines)
2. PROBLEM: Describe the common challenges people face related to this news (4-5 lines)
3. SOLUTION: Show how TLB specifically addresses these pain points. Mention features like:
   - Aggregated land records from multiple government portals
   - Due diligence reports
   - Fair value / benchmark value lookup
   - Mutation history tracking
   - Cadastral map access
   (Pick 2-3 relevant ones, explain in 4-5 lines)
4. IMPACT: Share what this means for the user (time saved, risk reduced, etc.) (2-3 lines)
5. CTA: Invite readers to try TLB with a specific next step (1-2 lines)
6. HASHTAGS: Include 5-7 relevant hashtags on a new line

Important rules:
- Use line breaks between sections for readability
- Helpful, not salesy tone
- Do NOT use em dashes or en dashes anywhere (use commas or periods instead)
- Do NOT use the word "crucial"
- Focus on value, not features`
  }
};

async function generatePost(article, postType = 'news_commentary') {
  const typeConfig = POST_TYPES[postType] || POST_TYPES.news_commentary;

  const prompt = `${typeConfig.prompt}

NEWS ARTICLE:
Title: ${article.title}
Summary: ${article.summary || 'No summary available'}
Source: ${article.source}
Region: ${article.region}

Write the LinkedIn post now. It MUST be at least 250 words. Return ONLY the post text, nothing else. No markdown formatting, no asterisks for bold.

IMPORTANT: At the end of the post (before hashtags), add this line:
Follow The Land Bank for more insights: https://www.linkedin.com/company/112976963`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content generated');

  return text.trim();
}

async function generateImagePrompt(article, postContent) {
  const prompt = `Based on this LinkedIn post about land/property news in India, generate a detailed image description (3-4 sentences) for an AI image generator.

The image should be:
- Professional and suitable for LinkedIn
- Visually represent the topic (land, property, real estate, government buildings, maps, etc.)
- Modern, clean aesthetic with warm colors
- NO text, NO watermarks, NO logos in the image

Post: ${postContent.substring(0, 500)}
Topic: ${article.title}
Region: ${article.region}

Return ONLY the image description, nothing else.`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) throw new Error('Failed to generate image prompt');

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function generateImage(imagePrompt) {
  // Use Gemini 2.5 Flash Image for native image generation
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Generate a professional, high-quality image for a LinkedIn post about Indian land and property. No text or words in the image at all. Clean, modern aesthetic. ${imagePrompt}`
        }]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('Image generation failed:', response.status, err);
    throw new Error(`Image generation failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);

  if (!imagePart) {
    console.error('No image in response. Parts:', JSON.stringify(parts.map(p => Object.keys(p))));
    throw new Error('No image returned from Gemini');
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}

// ==================== LINKEDIN ARTICLE TYPES ====================
const ARTICLE_TYPES = {
  educational: {
    label: 'Educational Guide',
    prompt: `You are a content strategist for "The Land Bank" (TLB), a proptech platform simplifying land records and due diligence in India.

Write a comprehensive, educational LinkedIn article. The article MUST be 800-1200 words. Structure it as follows:

1. TITLE: A compelling, SEO-friendly title (return on first line, prefixed with "TITLE: ")
2. SUBTITLE: A one-line subtitle that summarizes the value (return on second line, prefixed with "SUBTITLE: ")
3. INTRODUCTION: 2-3 paragraphs that hook the reader with a relatable scenario or surprising fact
4. MAIN BODY: 3-4 sections with clear headings (use ## for headings). Each section should:
   - Explain a concept clearly for first-time land buyers/investors
   - Include practical, actionable advice
   - Reference relevant Indian laws, government portals, or processes where applicable
5. KEY TAKEAWAYS: A bulleted list of 4-5 main points
6. CONCLUSION: 2-3 lines with a forward-looking statement
7. End with: "Published by The Land Bank | Simplifying Land Records & Due Diligence | www.thelandbankers.com"

Important rules:
- Write in simple, jargon-free language. Explain technical terms when first used.
- Use real examples from Indian states (Odisha, Karnataka, etc.)
- Reference actual government portals (Bhulekh, Bhoomi, Kaveri, etc.) where relevant
- Do NOT use em dashes or en dashes anywhere (use commas or periods instead)
- Do NOT use the word "crucial"
- Use ## for section headings (LinkedIn articles support this)
- Make it genuinely helpful, not promotional`
  },
  market_analysis: {
    label: 'Market Analysis',
    prompt: `You are a real estate market analyst writing for "The Land Bank" (TLB), a proptech platform in India.

Write an in-depth LinkedIn article analyzing market trends. The article MUST be 800-1200 words. Structure:

1. TITLE: An attention-grabbing analytical title (return on first line, prefixed with "TITLE: ")
2. SUBTITLE: A one-line insight (return on second line, prefixed with "SUBTITLE: ")
3. EXECUTIVE SUMMARY: 2-3 lines summarizing the key finding
4. MARKET OVERVIEW: Current state of the land/property market with context
5. KEY TRENDS: 3-4 trends with analysis (use ## for headings). Include:
   - Data points and statistics where possible
   - Government policy impacts
   - Regional variations (Odisha, Karnataka, national)
6. IMPLICATIONS: What this means for landowners, investors, and developers
7. OUTLOOK: Forward-looking predictions for the next 6-12 months
8. End with: "Published by The Land Bank | Simplifying Land Records & Due Diligence | www.thelandbankers.com"

Important rules:
- Authoritative, data-driven tone
- Reference RERA, government initiatives, digital land records progress
- Do NOT use em dashes or en dashes anywhere
- Do NOT use the word "crucial"
- Use ## for section headings`
  },
  land_security: {
    label: 'Land Security & Protection',
    prompt: `You are a land rights and property security expert writing for "The Land Bank" (TLB), a proptech platform in India.

Write a comprehensive LinkedIn article about land security and protection. The article MUST be 800-1200 words. Structure:

1. TITLE: A compelling title about land security (return on first line, prefixed with "TITLE: ")
2. SUBTITLE: One-line summary (return on second line, prefixed with "SUBTITLE: ")
3. INTRODUCTION: Start with a real-world scenario of land fraud or dispute that readers can relate to
4. THE PROBLEM: Explain common land security challenges in India (encroachment, forged documents, benami transactions, etc.)
5. PROTECTION GUIDE: 3-4 detailed sections (use ## for headings) covering:
   - Document verification steps
   - Government portals and tools available
   - Legal safeguards and due diligence checklist
   - Role of technology in land security
6. CHECKLIST: A practical checklist of 5-7 items for protecting land ownership
7. CONCLUSION: Empowering message about taking control of land security
8. End with: "Published by The Land Bank | Simplifying Land Records & Due Diligence | www.thelandbankers.com"

Important rules:
- Practical, action-oriented advice
- Reference actual Indian laws (Registration Act, Transfer of Property Act, etc.)
- Include state-specific portals and processes
- Do NOT use em dashes or en dashes anywhere
- Do NOT use the word "crucial"`
  },
  land_documents: {
    label: 'Land Documents Guide',
    prompt: `You are a land documentation expert writing for "The Land Bank" (TLB), a proptech platform in India.

Write a detailed LinkedIn article explaining land documents. The article MUST be 800-1200 words. Structure:

1. TITLE: Clear, searchable title about the document/process (return on first line, prefixed with "TITLE: ")
2. SUBTITLE: One-line description (return on second line, prefixed with "SUBTITLE: ")
3. INTRODUCTION: Why this document matters and common confusion around it
4. DETAILED EXPLANATION: 3-4 sections (use ## for headings) covering:
   - What the document is and its legal significance
   - How to obtain it (step-by-step process)
   - State-wise variations (how it differs in Odisha, Karnataka, etc.)
   - Common mistakes and how to avoid them
5. DOCUMENT CHECKLIST: What to verify in the document
6. DIGITAL ACCESS: How to access these records online (specific portal names and URLs)
7. CONCLUSION: Summary and next steps
8. End with: "Published by The Land Bank | Simplifying Land Records & Due Diligence | www.thelandbankers.com"

Important rules:
- Extremely practical and step-by-step
- Use real portal names: Bhulekh (Odisha), Bhoomi/Kaveri (Karnataka), etc.
- Explain in simple language, assume reader is a first-time buyer
- Do NOT use em dashes or en dashes anywhere
- Do NOT use the word "crucial"`
  }
};

async function generateArticle(source, articleType = 'educational') {
  const typeConfig = ARTICLE_TYPES[articleType] || ARTICLE_TYPES.educational;

  let contextBlock = '';
  if (source.articleId) {
    // From scraped news
    contextBlock = `
BASED ON THIS NEWS:
Title: ${source.title || ''}
Summary: ${source.summary || ''}
Source: ${source.source || ''}
Region: ${source.region || ''}`;
  } else {
    // Custom topic
    contextBlock = `
TOPIC: ${source.topic}`;
  }

  const prompt = `${typeConfig.prompt}
${contextBlock}

Write the full LinkedIn article now. Return the complete article with TITLE: and SUBTITLE: on the first two lines, followed by the full article body. No markdown bold (**) formatting, only use ## for section headings.`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content generated');

  // Parse title and subtitle from the generated text
  const lines = text.trim().split('\n');
  let title = '';
  let subtitle = '';
  let bodyStartIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('TITLE:')) {
      title = lines[i].replace('TITLE:', '').trim();
      bodyStartIndex = i + 1;
    } else if (lines[i].startsWith('SUBTITLE:')) {
      subtitle = lines[i].replace('SUBTITLE:', '').trim();
      bodyStartIndex = i + 1;
    } else if (title && (subtitle || i > 3)) {
      bodyStartIndex = i;
      break;
    }
  }

  const content = lines.slice(bodyStartIndex).join('\n').trim();

  return { title, subtitle, content };
}

async function generateCoverImagePrompt(title, articleType) {
  const prompt = `Generate a detailed image description (3-4 sentences) for an AI image generator to create a LinkedIn article cover image.

Article title: "${title}"
Article type: ${articleType}

The cover image should be:
- Wide format (landscape, 16:9 ratio) suitable for a LinkedIn article header
- Professional, modern, and visually striking
- Related to Indian land, property, real estate, or government services
- Clean aesthetic with warm, inviting colors
- NO text, NO watermarks, NO logos in the image
- Think editorial photography or high-quality illustration style

Return ONLY the image description, nothing else.`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) throw new Error('Failed to generate cover image prompt');

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function condenseArticleForPost(title, content) {
  const prompt = `You are the social media manager for "The Land Bank" (TLB), a proptech platform in India.

Take this LinkedIn article and create a compelling LinkedIn POST (not article) that summarizes the key points and drives engagement.

The post MUST be under 2800 characters (this is critical, LinkedIn has a character limit).

Structure:
1. HOOK: Bold opening line that makes people stop scrolling (1-2 lines)
2. KEY POINTS: 3-4 most valuable takeaways from the article, using bullet points
3. INSIGHT: One powerful insight or stat from the article (1-2 lines)
4. CTA: Ask a question to drive comments + mention the article for more details (1-2 lines)
5. HASHTAGS: 5-7 relevant hashtags

ARTICLE TITLE: ${title}

ARTICLE CONTENT:
${content.substring(0, 3000)}

Important rules:
- Keep it UNDER 2800 characters total
- Do NOT use em dashes or en dashes
- Do NOT use the word "crucial"
- No markdown formatting, no asterisks
- End with: Follow The Land Bank for more insights: https://www.linkedin.com/company/112976963

Return ONLY the post text.`;

  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content generated');
  return text.trim();
}

module.exports = { generatePost, generateImagePrompt, generateImage, generateArticle, generateCoverImagePrompt, condenseArticleForPost, POST_TYPES, ARTICLE_TYPES };
