require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const fs = require('fs');

// Setup fontconfig so libvips/librsvg finds our bundled Noto fonts on any
// platform (Linux deploys in particular). This MUST run before sharp loads.
(function setupFontconfig() {
  try {
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    if (!fs.existsSync(fontsDir)) return;
    const confDir = path.join(__dirname, '..', 'assets', 'fontconfig');
    fs.mkdirSync(confDir, { recursive: true });
    const cacheDir = path.join(require('os').tmpdir(), 'fontconfig-cache-tlb');
    fs.mkdirSync(cacheDir, { recursive: true });
    const confPath = path.join(confDir, 'fonts.conf');
    fs.writeFileSync(confPath, `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <dir>/usr/share/fonts</dir>
  <dir>/usr/local/share/fonts</dir>
  <dir>/System/Library/Fonts</dir>
  <dir>/System/Library/Fonts/Supplemental</dir>
  <dir prefix="xdg">fonts</dir>
  <cachedir>${cacheDir}</cachedir>
  <config></config>
</fontconfig>`);
    process.env.FONTCONFIG_PATH = confDir;
    process.env.FONTCONFIG_FILE = confPath;
  } catch (e) {
    console.warn('[poster] fontconfig setup failed:', e.message);
  }
})();

const sharp = require('sharp');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';

// ==================== BRAND ====================
const TLB_BRAND = {
  teal: '#7DD3BD',
  tealSoft: '#A8E6D3',
  navyDeep: '#0A1628',
  navyMid: '#142840',
  cream: '#F5F1EA',
  white: '#FFFFFF'
};

const TLB_PHONE = process.env.TLB_PHONE || '+91 63725 15684';
const TLB_WEBSITE = process.env.TLB_WEBSITE || 'www.thelandbankers.com';
const LOGO_PATH = path.join(__dirname, '..', 'public', 'assets', 'tlb-logo.png');

// ==================== OCCASIONS ====================
const OCCASIONS = {
  diwali: {
    label: 'Diwali',
    context: 'Festival of Lights. Warm diyas, golden glow, fireworks, marigold, theme of prosperity and illumination'
  },
  eid: {
    label: 'Eid',
    context: 'Eid celebration. Crescent moon, stars, lanterns, mosque silhouettes, theme of blessings and togetherness'
  },
  christmas: {
    label: 'Christmas',
    context: 'Christmas celebration. Subtle pine, soft bokeh lights, warm festive tones, theme of joy and giving'
  },
  new_year: {
    label: 'New Year',
    context: 'New Year celebration. Golden sparkles, fireworks, night sky, theme of fresh beginnings and prosperity'
  },
  onam: {
    label: 'Onam',
    context: 'Onam festival. Pookalam floral carpet, Kerala traditions, banana leaves, theme of abundance and heritage'
  },
  independence_day: {
    label: 'Independence Day',
    context: '15 August Independence Day. Indian tricolor, Ashoka chakra, patriotic and proud tones'
  },
  republic_day: {
    label: 'Republic Day',
    context: '26 January Republic Day. Indian tricolor, constitution motifs, democracy'
  },
  holi: {
    label: 'Holi',
    context: 'Festival of colors. Vibrant pink, yellow, green, blue splashes, theme of joy and spring'
  },
  raksha_bandhan: {
    label: 'Raksha Bandhan',
    context: 'Sibling bond festival. Rakhi threads, warm tones, theme of protection and family bonds'
  },
  dussehra: {
    label: 'Dussehra',
    context: 'Victory of good over evil. Bow and arrow motifs, golden orange tones, theme of triumph'
  },
  ganesh_chaturthi: {
    label: 'Ganesh Chaturthi',
    context: 'Lord Ganesha motifs, marigold, modak, theme of wisdom and fresh beginnings'
  },
  pongal: {
    label: 'Pongal / Makar Sankranti',
    context: 'Harvest festival. Sugarcane, pongal pot, sun motifs, kolam patterns, theme of gratitude and abundance'
  },
  ugadi: {
    label: 'Ugadi / Gudi Padwa',
    context: 'Hindu New Year. Gudi flags, mango leaves, marigold, theme of fresh beginnings'
  },
  land_promo: {
    label: 'Land / Property Promo',
    context: 'Land banking, property investment, Indian fields and skyline, secure land ownership'
  },
  trust: {
    label: 'Trust & Security',
    context: 'Trust, verified documents, shield, protected land ownership, peace of mind'
  },
  custom: {
    label: 'Custom (use your prompt)',
    context: ''
  }
};

// ==================== LANGUAGES ====================
const LANGUAGES = {
  english: {
    label: 'English',
    code: 'en',
    font: 'Noto Sans, DM Sans, Arial, sans-serif'
  },
  odia: {
    label: 'Odia (ଓଡ଼ିଆ)',
    code: 'or',
    font: 'Noto Sans Oriya, Anek Odia, Noto Sans, sans-serif'
  },
  kannada: {
    label: 'Kannada (ಕನ್ನಡ)',
    code: 'kn',
    font: 'Noto Sans Kannada, Kannada Sangam MN, Noto Sans, sans-serif'
  }
};

// ==================== SIZES ====================
const SIZES = {
  square: { label: 'Square Post (1:1)', width: 1080, height: 1080, aspect: '1:1 square' },
  portrait: { label: 'Portrait Post (4:5)', width: 1080, height: 1350, aspect: '4:5 portrait' },
  story: { label: 'Story / Reel (9:16)', width: 1080, height: 1920, aspect: '9:16 vertical' },
  landscape: { label: 'LinkedIn / FB (1.91:1)', width: 1200, height: 628, aspect: '1.91:1 landscape' }
};

// ==================== BACKGROUND STYLES ====================
const BG_STYLES = {
  plain: {
    label: 'Plain / Gradient',
    desc: 'elegant solid or subtle gradient background using TLB deep navy (#0A1628) transitioning to mid navy (#142840) with faint teal accent highlights, minimalist and classy with plenty of negative space'
  },
  graphics: {
    label: 'Graphics / Illustration',
    desc: 'abstract modern graphics and soft geometric illustrated elements, festive or thematic motifs rendered in an editorial illustration style, subtle and premium'
  },
  people: {
    label: 'With People',
    desc: 'warm lifestyle photography of Indian people, family or individuals in an authentic and respectful composition, soft depth of field, cinematic tones'
  }
};

// ==================== GEMINI HELPERS ====================
async function fetchWithRetry(url, options, { maxAttempts = 6, baseDelay = 2000 } = {}) {
  let lastErr = new Error('Gemini request failed');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status === 503 || res.status === 429 || res.status === 500 || res.status === 502 || res.status === 504) {
        const delay = Math.min(30000, baseDelay * Math.pow(2, attempt - 1));
        console.warn(`Gemini ${res.status}, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        lastErr = new Error(`Gemini ${res.status}`);
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, delay));
        continue;
      }
      const err = await res.text();
      throw new Error(`Gemini error: ${res.status} - ${err.substring(0, 200)}`);
    } catch (e) {
      lastErr = e;
      if (attempt === maxAttempts) throw e;
      const delay = Math.min(30000, baseDelay * Math.pow(2, attempt - 1));
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function geminiText(prompt, { temperature = 0.8, maxTokens = 512, noThinking = true } = {}) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  };
  if (noThinking) body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetchWithRetry(`${GEMINI_TEXT_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

async function geminiImage(prompt) {
  const res = await fetchWithRetry(`${GEMINI_IMAGE_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    })
  });
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(p => p.inlineData);
  if (!imagePart) throw new Error('No image returned from Gemini');
  return Buffer.from(imagePart.inlineData.data, 'base64');
}

// ==================== COPY GENERATION ====================
async function generatePosterCopy({ occasion, customPrompt, language }) {
  const occ = OCCASIONS[occasion] || OCCASIONS.custom;
  const lang = LANGUAGES[language] || LANGUAGES.english;

  let langInstruction;
  if (lang.code === 'en') {
    langInstruction = 'Write headline, subtext and tagline in clear, classy English.';
  } else if (lang.code === 'or') {
    langInstruction = 'Write headline, subtext and tagline in Odia using native Odia script (ଓଡ଼ିଆ). Use natural, culturally appropriate Odia. Do NOT transliterate into English letters.';
  } else {
    langInstruction = 'Write headline, subtext and tagline in Kannada using native Kannada script (ಕನ್ನಡ). Use natural, culturally appropriate Kannada. Do NOT transliterate into English letters.';
  }

  const prompt = `You are the brand copywriter for "The Land Bank" (TLB), a PropTech platform in India that simplifies land records, due diligence and land banking.

Create copy for a social media poster.

Occasion/Theme: ${occ.label}${occ.context ? ` — ${occ.context}` : ''}
${customPrompt ? `User brief: ${customPrompt}` : ''}

${langInstruction}

Return ONLY a valid JSON object (no markdown fences, no explanation) with these exact keys:
{
  "headline": "Main bold line, 2-4 words MAX, eye-catching",
  "subtext": "Supporting wish or message, 8-14 words, warm and classy",
  "tagline": "Short brand tagline, 3-5 words"
}

Rules:
- Do NOT use em dashes or en dashes anywhere (use commas or periods)
- Keep everything concise, premium, respectful
- Headline must be SHORT and impactful (max 4 words)
- For festivals, celebratory but classy tone
- For land/business content, trustworthy and professional tone`;

  const raw = await geminiText(prompt, { temperature: 0.9, maxTokens: 1024, noThinking: true });
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.substring(start, end + 1);
  try {
    const parsed = JSON.parse(cleaned);
    return {
      headline: (parsed.headline || '').trim(),
      subtext: (parsed.subtext || '').trim(),
      tagline: (parsed.tagline || '').trim()
    };
  } catch (e) {
    console.error('Failed to parse copy JSON:', cleaned);
    return { headline: '', subtext: '', tagline: '' };
  }
}

// ==================== BACKGROUND PROMPT ====================
async function generateBackgroundPrompt({ occasion, customPrompt, backgroundStyle, size }) {
  const occ = OCCASIONS[occasion] || OCCASIONS.custom;
  const bg = BG_STYLES[backgroundStyle] || BG_STYLES.graphics;
  const sizeCfg = SIZES[size] || SIZES.square;

  return `Create a premium social media poster BACKGROUND image for "The Land Bank" (TLB), a PropTech company in India.

Concept: ${occ.context || 'land and property branding in India'}
${customPrompt ? `Additional context: ${customPrompt}` : ''}

Background style: ${bg.desc}

Critical requirements:
- Aspect ratio: ${sizeCfg.aspect} (${sizeCfg.width}x${sizeCfg.height})
- Use TLB brand palette: deep navy (#0A1628), mid navy (#142840), teal mint accent (#7DD3BD), warm cream (#F5F1EA)
- Leave the LOWER HALF of the image relatively clean or softly darkened so text and logo can be clearly overlaid
- Elegant, editorial, magazine-quality design
- Generous breathing space and negative space
- Subtle vignette or soft dark gradient at the bottom for text legibility
- Absolutely NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO WATERMARKS of any kind
- Classy and premium feel, not cluttered or busy`;
}

async function generateBackgroundImage(opts) {
  const prompt = await generateBackgroundPrompt(opts);
  return await geminiImage(prompt);
}

// ==================== SVG OVERLAY ====================
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapTextLines(text, maxChars) {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildOverlaySvg({ width, height, headline, subtext, tagline, phone, website, fontFamily, logoPillRect }) {
  const isLandscape = width > height;

  // Font sizes based on shortest dimension for consistency
  const base = Math.min(width, height);
  const headlineSize = isLandscape ? Math.round(base * 0.14) : Math.round(base * 0.1);
  const subtextSize = Math.round(base * 0.034);
  const taglineSize = Math.round(base * 0.028);
  const metaSize = Math.round(base * 0.025);

  // Character width estimate (0.55 for latin, 0.65 for complex scripts average)
  const charW = 0.58;
  const headlineMaxChars = Math.max(6, Math.floor((width * 0.84) / (headlineSize * charW)));
  const subtextMaxChars = Math.max(10, Math.floor((width * 0.82) / (subtextSize * charW)));

  const headlineLines = wrapTextLines(headline, headlineMaxChars).slice(0, 3);
  const subtextLines = wrapTextLines(subtext, subtextMaxChars).slice(0, 3);

  // Layout anchored from bottom
  const padBottom = Math.round(height * 0.055);
  const centerX = width / 2;

  // Bottom: website+phone
  const metaY = height - padBottom;

  // Logo pill above meta
  const pillHeight = logoPillRect.height;
  const pillWidth = logoPillRect.width;
  const pillGapBelow = Math.round(base * 0.022);
  const pillBottom = metaY - metaSize - pillGapBelow;
  const pillTop = pillBottom - pillHeight;
  const pillX = Math.round((width - pillWidth) / 2);

  // Subtext above pill
  const subtextGapBelow = Math.round(base * 0.035);
  const subtextBlockHeight = subtextLines.length * subtextSize * 1.35;
  const subtextBottom = pillTop - subtextGapBelow;
  const subtextStartY = subtextBottom - subtextBlockHeight + subtextSize;

  // Headline above subtext
  const headlineGapBelow = Math.round(base * 0.025);
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.05;
  const headlineBottom = subtextBottom - subtextBlockHeight - headlineGapBelow;
  const headlineStartY = headlineBottom - headlineBlockHeight + headlineSize;

  // Tagline above headline
  const taglineGap = Math.round(base * 0.025);
  const taglineY = headlineStartY - headlineSize - taglineGap;

  // Gradient start where content begins
  const contentTop = Math.max(0, taglineY - taglineSize * 2);
  const gradPct = Math.max(10, Math.min(90, Math.round((contentTop / height) * 100)));

  const headlineTspans = headlineLines.map((line, i) =>
    `<tspan x="${centerX}" dy="${i === 0 ? 0 : Math.round(headlineSize * 1.05)}">${escapeXml(line)}</tspan>`
  ).join('');

  const subtextTspans = subtextLines.map((line, i) =>
    `<tspan x="${centerX}" dy="${i === 0 ? 0 : Math.round(subtextSize * 1.35)}">${escapeXml(line)}</tspan>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A1628" stop-opacity="0"/>
      <stop offset="${gradPct}%" stop-color="#0A1628" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0A1628" stop-opacity="0.9"/>
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#readGrad)"/>

  ${tagline ? `
  <text x="${centerX}" y="${taglineY}"
        font-family="${fontFamily}"
        font-size="${taglineSize}"
        font-weight="500"
        fill="${TLB_BRAND.teal}"
        text-anchor="middle"
        letter-spacing="3">${escapeXml(tagline.toUpperCase())}</text>
  ` : ''}

  <text x="${centerX}" y="${headlineStartY}"
        font-family="${fontFamily}"
        font-size="${headlineSize}"
        font-weight="700"
        fill="#FFFFFF"
        text-anchor="middle"
        letter-spacing="-0.5">${headlineTspans}</text>

  <text x="${centerX}" y="${subtextStartY}"
        font-family="${fontFamily}"
        font-size="${subtextSize}"
        font-weight="400"
        fill="#EAF0F7"
        text-anchor="middle">${subtextTspans}</text>

  <rect x="${pillX}" y="${pillTop}" width="${pillWidth}" height="${pillHeight}"
        rx="${Math.round(pillHeight * 0.22)}"
        fill="${TLB_BRAND.cream}"
        fill-opacity="0.98"/>

  <text x="${centerX}" y="${metaY}"
        font-family="Noto Sans, DM Sans, sans-serif"
        font-size="${metaSize}"
        font-weight="500"
        fill="#FFFFFF"
        fill-opacity="0.88"
        text-anchor="middle"
        letter-spacing="1.2">${escapeXml(website)}   •   ${escapeXml(phone)}</text>
</svg>`;
}

// ==================== MAIN POSTER BUILDER ====================
async function generatePoster({ occasion = 'custom', customPrompt = '', backgroundStyle = 'graphics', size = 'square', language = 'english', headline, subtext, tagline }) {
  const sizeCfg = SIZES[size] || SIZES.square;
  const lang = LANGUAGES[language] || LANGUAGES.english;
  const { width, height } = sizeCfg;

  // 1. Copy: use user-provided or generate with AI
  let copy = {
    headline: (headline || '').trim(),
    subtext: (subtext || '').trim(),
    tagline: (tagline || '').trim()
  };
  if (!copy.headline || !copy.subtext) {
    const aiCopy = await generatePosterCopy({ occasion, customPrompt, language });
    copy = {
      headline: copy.headline || aiCopy.headline,
      subtext: copy.subtext || aiCopy.subtext,
      tagline: copy.tagline || aiCopy.tagline
    };
  }

  // 2. Background image from Gemini
  const bgBuffer = await generateBackgroundImage({ occasion, customPrompt, backgroundStyle, size });

  // 3. Resize background to exact poster size (cover fit)
  const bgResized = await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .toBuffer();

  // 4. Prepare logo: scale to target size and place on cream pill
  const logoTargetWidth = Math.round(width * 0.28);
  const logoBuffer = await sharp(LOGO_PATH)
    .resize({ width: logoTargetWidth, fit: 'inside' })
    .toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();

  // Pill dimensions (logo + padding)
  const pillPadX = Math.round(logoMeta.width * 0.12);
  const pillPadY = Math.round(logoMeta.height * 0.28);
  const pillWidth = logoMeta.width + pillPadX * 2;
  const pillHeight = logoMeta.height + pillPadY * 2;

  // 5. Build SVG overlay (includes gradient, text, pill shape, website/phone line)
  const overlaySvg = buildOverlaySvg({
    width, height,
    headline: copy.headline,
    subtext: copy.subtext,
    tagline: copy.tagline,
    phone: TLB_PHONE,
    website: TLB_WEBSITE,
    fontFamily: lang.font,
    logoPillRect: { width: pillWidth, height: pillHeight }
  });

  // Compute logo position (inside the pill, centered)
  const metaSize = Math.round(Math.min(width, height) * 0.025);
  const padBottom = Math.round(height * 0.055);
  const metaY = height - padBottom;
  const pillGapBelow = Math.round(Math.min(width, height) * 0.022);
  const pillBottom = metaY - metaSize - pillGapBelow;
  const pillTop = pillBottom - pillHeight;
  const logoTop = pillTop + pillPadY;
  const logoLeft = Math.round((width - logoMeta.width) / 2);

  // 6. Final composite
  const finalBuffer = await sharp(bgResized)
    .composite([
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      { input: logoBuffer, top: logoTop, left: logoLeft }
    ])
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();

  return {
    buffer: finalBuffer,
    copy,
    size: sizeCfg,
    mimeType: 'image/png'
  };
}

module.exports = {
  OCCASIONS, LANGUAGES, SIZES, BG_STYLES, TLB_BRAND,
  generatePoster, generatePosterCopy, generateBackgroundImage
};
