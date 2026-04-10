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
// Official TLB palette from https://www.thelandbankers.com/branding
const TLB_BRAND = {
  teal50:  '#F0FAF9',
  teal100: '#D4F0ED',
  teal200: '#A8E2DB',
  teal300: '#6DCEC5',
  teal400: '#30B0A4', // primary
  teal500: '#289990',
  teal600: '#207B74',
  teal700: '#1A635E',
  dark900: '#0C1421',
  dark800: '#101828',
  dark700: '#1A2332',
  slate700: '#334155',
  gray500: '#667085',
  white: '#FFFFFF'
};

const TLB_PHONE = process.env.TLB_PHONE || '+91 63725 15684';
const TLB_WEBSITE = process.env.TLB_WEBSITE || 'www.thelandbankers.com';
const LOGO_DARK_PATH  = path.join(__dirname, '..', 'public', 'assets', 'tlb-logo-dark.svg');  // for light bg
const LOGO_WHITE_PATH = path.join(__dirname, '..', 'public', 'assets', 'tlb-logo-white.svg'); // for dark bg
const LOGO_ASPECT = 3645 / 974; // w/h of the SVG viewBox

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
// TLB brand typeface is DM Sans. Noto Sans is a close geometric fallback.
// Odia/Kannada need their dedicated Noto families to render script correctly.
const LANGUAGES = {
  english: {
    label: 'English',
    code: 'en',
    font: 'DM Sans, Noto Sans, Arial, sans-serif'
  },
  odia: {
    label: 'Odia (ଓଡ଼ିଆ)',
    code: 'or',
    font: 'Noto Sans Oriya, DM Sans, Noto Sans, sans-serif'
  },
  kannada: {
    label: 'Kannada (ಕನ್ನಡ)',
    code: 'kn',
    font: 'Noto Sans Kannada, DM Sans, Noto Sans, sans-serif'
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
// Subject only — palette/mood comes from the user's brief ("Your idea / brief")
// so users can say "vibrant festive" / "monochrome gold" / "warm golden hour".
const BG_STYLES = {
  plain: {
    label: 'Plain / Gradient',
    desc: 'an elegant minimalist background — solid or subtle gradient — with plenty of negative space and a single soft highlight, editorial and premium'
  },
  graphics: {
    label: 'Graphics / Illustration',
    desc: 'abstract modern graphics and soft geometric illustrated elements, thematic motifs rendered in an editorial illustration style, premium and uncluttered'
  },
  people: {
    label: 'With People',
    desc: 'warm lifestyle photography of Indian people, family or individuals in an authentic and respectful composition, soft depth of field, cinematic tones, editorial quality'
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

  const prompt = `You are the brand copywriter for "The Land Bankers" (TLB), India's first land rating platform. TLB helps landowners verify documents, monitor boundaries, value their land, and resolve disputes. Official brand tagline: "We protect your land, online and on ground, not just on papers."

TLB brand voice is: clear, trustworthy, helpful, and grounded. Approachable but never casual. Informed but never intimidating. Real talk about land ownership in India, not Silicon Valley hype. Plain language, not jargon.

Create copy for a social media poster.

Occasion/Theme: ${occ.label}${occ.context ? ` — ${occ.context}` : ''}
${customPrompt ? `User brief: ${customPrompt}` : ''}

${langInstruction}

Return ONLY a valid JSON object (no markdown fences, no explanation) with these exact keys:
{
  "headline": "Main bold line, 2-4 words MAX, eye-catching",
  "subtext": "Supporting message, 8-14 words, warm and grounded",
  "tagline": "Short brand line, 3-5 words"
}

Rules:
- Do NOT use em dashes or en dashes anywhere. Use commas or periods.
- Keep everything concise, confident, respectful
- Headline must be SHORT and impactful (max 4 words)
- For festivals, warm and celebratory but never over the top
- For land/business themes, trustworthy and plain-spoken, never salesy
- Never use cliches like "unlock", "revolutionise", "game changer"
- Sound like someone who actually understands land, not a marketing agency`;

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

  // Palette direction: if the user brief mentions any colour/mood cues, they take
  // precedence over the default brand palette. Otherwise stick to TLB navy + teal.
  const hasBrief = Boolean(customPrompt && customPrompt.trim());
  const paletteRule = hasBrief
    ? `- Colour and mood direction: follow the user brief above exactly. If the brief mentions specific colours, moods, or a palette (e.g. "vibrant pinks", "monochrome gold", "warm pastel"), those OVERRIDE any default brand palette. Do NOT add TLB navy or teal unless the brief asks for it.`
    : `- Colour palette: use TLB brand palette only — dark navy (#0C1421), dark slate (#101828), TLB teal (#30B0A4), soft teal (#A8E2DB). Do not introduce other colours.`;

  return `Create a premium social media poster BACKGROUND image for "The Land Bankers" (TLB), India's first land rating platform.

Concept / Occasion: ${occ.context || 'land and property branding in India'}
${hasBrief ? `User brief (HIGHEST PRIORITY — follow this for mood, colours, subject details): ${customPrompt.trim()}` : ''}

Subject style: ${bg.desc}

Critical requirements:
- Aspect ratio: ${sizeCfg.aspect} (${sizeCfg.width}x${sizeCfg.height})
${paletteRule}
- Leave the LOWER HALF of the image relatively clean or softly darkened so text and logo can be clearly overlaid on top
- Keep the composition balanced with clear breathing space, editorial and magazine-quality
- Subtle vignette or soft darkening toward the bottom edge to help text legibility
- Absolutely NO TEXT, NO WORDS, NO LETTERS, NO LOGOS, NO WATERMARKS, NO TYPOGRAPHY of any kind anywhere in the image
- Premium, confident, uncluttered. Never busy, never tacky.`;
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

// ==================== LAYOUT TEMPLATES ====================
// Four distinct layouts so every regenerate gives a visually different poster.
// - center-classic: centered stack (tagline / headline / sub / logo), bottom-weighted
// - bottom-left:    editorial, all text anchored bottom-left, logo bottom-right
// - top-hero:       big headline near the top, subtext + logo at the bottom
// - minimal-center: just a big headline mid-frame, small sub, tiny logo, no tagline
const LAYOUT_TEMPLATES = ['center-classic', 'bottom-left', 'top-hero', 'minimal-center'];

function pickRandomTemplate(exclude) {
  const pool = LAYOUT_TEMPLATES.filter(t => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Compute the full layout for a given template. Each layout function wraps the
// actual copy, positions every text block, the logo, and defines the gradient
// stops. buildOverlaySvg just reads the returned geometry and draws it.
function computePosterLayout({ width, height, template, headline, subtext, tagline }) {
  const map = {
    'center-classic': layoutCenterClassic,
    'bottom-left':    layoutBottomLeft,
    'top-hero':       layoutTopHero,
    'minimal-center': layoutMinimalCenter
  };
  const fn = map[template] || map['center-classic'];
  return fn({ width, height, headline, subtext, tagline });
}

function layoutCenterClassic({ width, height, headline, subtext, tagline }) {
  const base = Math.min(width, height);
  const isLandscape = width > height;

  const headlineSize = isLandscape ? Math.round(base * 0.14) : Math.round(base * 0.10);
  const subtextSize  = Math.round(base * 0.034);
  const taglineSize  = Math.round(base * 0.028);
  const metaSize     = Math.round(base * 0.025);

  const charW = 0.58;
  const headlineMaxChars = Math.max(6, Math.floor((width * 0.84) / (headlineSize * charW)));
  const subtextMaxChars  = Math.max(10, Math.floor((width * 0.82) / (subtextSize * charW)));
  const headlineLines = wrapTextLines(headline, headlineMaxChars).slice(0, 3);
  const subtextLines  = wrapTextLines(subtext, subtextMaxChars).slice(0, 3);

  const padBottom = Math.round(height * 0.055);
  const metaY = height - padBottom;

  const logoWidth  = Math.round(width * 0.24);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);
  const logoGapBelow = Math.round(base * 0.022);
  const logoBottom = metaY - metaSize - logoGapBelow;
  const logoTop    = logoBottom - logoHeight;
  const logoLeft   = Math.round((width - logoWidth) / 2);

  const subtextGapBelow = Math.round(base * 0.035);
  const subtextBlockHeight = subtextLines.length * subtextSize * 1.35;
  const subtextBottom = logoTop - subtextGapBelow;
  const subtextStartY = subtextBottom - subtextBlockHeight + subtextSize;

  const headlineGapBelow = Math.round(base * 0.025);
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.05;
  const headlineBottom = subtextBottom - subtextBlockHeight - headlineGapBelow;
  const headlineStartY = headlineBottom - headlineBlockHeight + headlineSize;

  const taglineGap = Math.round(base * 0.025);
  const taglineY = headlineStartY - headlineSize - taglineGap;

  const contentTop = Math.max(0, taglineY - Math.round(base * 0.15));
  const gradPct = Math.max(5, Math.min(85, Math.round((contentTop / height) * 100)));

  const centerX = Math.round(width / 2);

  return {
    template: 'center-classic',
    base, width, height,
    logo: { left: logoLeft, top: logoTop, width: logoWidth, height: logoHeight },
    headline: {
      x: centerX, y: headlineStartY, size: headlineSize,
      anchor: 'middle', weight: 700, lineHeight: 1.05, lines: headlineLines,
      letterSpacing: -0.5
    },
    subtext: {
      x: centerX, y: subtextStartY, size: subtextSize,
      anchor: 'middle', weight: 400, lineHeight: 1.35, lines: subtextLines
    },
    tagline: tagline ? {
      x: centerX, y: taglineY, size: taglineSize,
      anchor: 'middle', weight: 500, letterSpacing: 3, text: tagline
    } : null,
    meta: {
      x: centerX, y: metaY, size: metaSize,
      anchor: 'middle', letterSpacing: 1.2
    },
    gradient: {
      stops: [
        { offset: 0,       opacity: 0 },
        { offset: gradPct, opacity: 0.55 },
        { offset: 100,     opacity: 0.94 }
      ]
    }
  };
}

function layoutBottomLeft({ width, height, headline, subtext, tagline }) {
  const base = Math.min(width, height);
  const isLandscape = width > height;

  const headlineSize = isLandscape ? Math.round(base * 0.13) : Math.round(base * 0.095);
  const subtextSize  = Math.round(base * 0.032);
  const taglineSize  = Math.round(base * 0.025);
  const metaSize     = Math.round(base * 0.022);

  const padX = Math.round(width * 0.06);
  const padBottom = Math.round(height * 0.055);

  // Logo anchored bottom-right
  const logoWidth  = Math.round(width * 0.20);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);
  const logoLeft   = width - padX - logoWidth;
  const metaY      = height - padBottom;
  const metaX      = width - padX;
  const logoGapBelow = Math.round(base * 0.018);
  const logoBottom = metaY - metaSize - logoGapBelow;
  const logoTop    = logoBottom - logoHeight;

  // Text block bottom-left, up to ~65% width so it never crashes into the logo
  const textMaxWidth = Math.round(width * 0.65);
  const charW = 0.58;
  const headlineMaxChars = Math.max(6, Math.floor(textMaxWidth / (headlineSize * charW)));
  const subtextMaxChars  = Math.max(10, Math.floor(textMaxWidth / (subtextSize * charW)));
  const headlineLines = wrapTextLines(headline, headlineMaxChars).slice(0, 3);
  const subtextLines  = wrapTextLines(subtext, subtextMaxChars).slice(0, 3);

  // Align the bottom of the text block with the bottom of the logo
  const textBottom = logoBottom;
  const subtextBlockHeight = subtextLines.length * subtextSize * 1.35;
  const subtextStartY = textBottom - subtextBlockHeight + subtextSize;

  const headlineGapBelow = Math.round(base * 0.025);
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.05;
  const headlineBottom = textBottom - subtextBlockHeight - headlineGapBelow;
  const headlineStartY = headlineBottom - headlineBlockHeight + headlineSize;

  const taglineGap = Math.round(base * 0.022);
  const taglineY = headlineStartY - headlineSize - taglineGap;

  const contentTop = Math.max(0, taglineY - Math.round(base * 0.12));
  const gradPct = Math.max(5, Math.min(85, Math.round((contentTop / height) * 100)));

  return {
    template: 'bottom-left',
    base, width, height,
    logo: { left: logoLeft, top: logoTop, width: logoWidth, height: logoHeight },
    headline: {
      x: padX, y: headlineStartY, size: headlineSize,
      anchor: 'start', weight: 700, lineHeight: 1.05, lines: headlineLines,
      letterSpacing: -0.5
    },
    subtext: {
      x: padX, y: subtextStartY, size: subtextSize,
      anchor: 'start', weight: 400, lineHeight: 1.35, lines: subtextLines
    },
    tagline: tagline ? {
      x: padX, y: taglineY, size: taglineSize,
      anchor: 'start', weight: 500, letterSpacing: 3, text: tagline
    } : null,
    meta: {
      x: metaX, y: metaY, size: metaSize,
      anchor: 'end', letterSpacing: 1.2
    },
    gradient: {
      stops: [
        { offset: 0,       opacity: 0 },
        { offset: gradPct, opacity: 0.55 },
        { offset: 100,     opacity: 0.94 }
      ]
    }
  };
}

function layoutTopHero({ width, height, headline, subtext, tagline }) {
  const base = Math.min(width, height);
  const isLandscape = width > height;

  const headlineSize = isLandscape ? Math.round(base * 0.14) : Math.round(base * 0.11);
  const subtextSize  = Math.round(base * 0.032);
  const taglineSize  = Math.round(base * 0.025);
  const metaSize     = Math.round(base * 0.022);

  const padTop    = Math.round(height * 0.09);
  const padBottom = Math.round(height * 0.055);
  const centerX   = Math.round(width / 2);

  const charW = 0.58;
  const headlineMaxChars = Math.max(6, Math.floor((width * 0.82) / (headlineSize * charW)));
  const subtextMaxChars  = Math.max(10, Math.floor((width * 0.72) / (subtextSize * charW)));
  const headlineLines = wrapTextLines(headline, headlineMaxChars).slice(0, 3);
  const subtextLines  = wrapTextLines(subtext, subtextMaxChars).slice(0, 2);

  // Tagline at the very top, headline right underneath
  const taglineY = padTop;
  const taglineGap = Math.round(base * 0.025);
  const headlineStartY = taglineY + taglineGap + headlineSize;
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.05;

  // Logo at bottom center
  const logoWidth  = Math.round(width * 0.22);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);
  const logoLeft   = Math.round((width - logoWidth) / 2);

  const metaY = height - padBottom;
  const logoGapBelow = Math.round(base * 0.02);
  const logoBottom = metaY - metaSize - logoGapBelow;
  const logoTop    = logoBottom - logoHeight;

  // Subtext directly above logo
  const subtextGapBelow = Math.round(base * 0.03);
  const subtextBottom = logoTop - subtextGapBelow;
  const subtextBlockHeight = subtextLines.length * subtextSize * 1.35;
  const subtextStartY = subtextBottom - subtextBlockHeight + subtextSize;

  // V-shaped gradient: dark band at top (behind headline), clear middle,
  // dark band at bottom (behind subtext + logo + meta)
  const topDarkEndY = taglineY + headlineBlockHeight + Math.round(base * 0.08);
  const bottomDarkStartY = subtextStartY - subtextSize - Math.round(base * 0.06);
  const topDarkEndPct = Math.max(15, Math.min(45, Math.round((topDarkEndY / height) * 100)));
  const bottomDarkStartPct = Math.max(55, Math.min(85, Math.round((bottomDarkStartY / height) * 100)));

  return {
    template: 'top-hero',
    base, width, height,
    logo: { left: logoLeft, top: logoTop, width: logoWidth, height: logoHeight },
    headline: {
      x: centerX, y: headlineStartY, size: headlineSize,
      anchor: 'middle', weight: 700, lineHeight: 1.05, lines: headlineLines,
      letterSpacing: -0.5
    },
    subtext: {
      x: centerX, y: subtextStartY, size: subtextSize,
      anchor: 'middle', weight: 400, lineHeight: 1.35, lines: subtextLines
    },
    tagline: tagline ? {
      x: centerX, y: taglineY, size: taglineSize,
      anchor: 'middle', weight: 500, letterSpacing: 3, text: tagline
    } : null,
    meta: {
      x: centerX, y: metaY, size: metaSize,
      anchor: 'middle', letterSpacing: 1.2
    },
    gradient: {
      stops: [
        { offset: 0,                  opacity: 0.80 },
        { offset: topDarkEndPct,      opacity: 0 },
        { offset: bottomDarkStartPct, opacity: 0 },
        { offset: 100,                opacity: 0.92 }
      ]
    }
  };
}

function layoutMinimalCenter({ width, height, headline, subtext, tagline }) {
  const base = Math.min(width, height);
  const isLandscape = width > height;

  const headlineSize = isLandscape ? Math.round(base * 0.18) : Math.round(base * 0.14);
  const subtextSize  = Math.round(base * 0.028);
  const metaSize     = Math.round(base * 0.02);

  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);

  const charW = 0.58;
  const headlineMaxChars = Math.max(4, Math.floor((width * 0.80) / (headlineSize * charW)));
  const subtextMaxChars  = Math.max(10, Math.floor((width * 0.72) / (subtextSize * charW)));
  const headlineLines = wrapTextLines(headline, headlineMaxChars).slice(0, 2);
  const subtextLines  = wrapTextLines(subtext, subtextMaxChars).slice(0, 2);

  // Centre the headline block vertically around the frame's mid-point
  const headlineBlockHeight = headlineLines.length * headlineSize * 1.03;
  const headlineStartY = centerY - Math.round(headlineBlockHeight / 2) + headlineSize;
  const headlineBottom = headlineStartY + headlineBlockHeight - headlineSize;

  const subtextGap = Math.round(base * 0.028);
  const subtextStartY = headlineBottom + subtextGap + subtextSize;

  // Small logo at the bottom
  const padBottom = Math.round(height * 0.055);
  const logoWidth  = Math.round(width * 0.16);
  const logoHeight = Math.round(logoWidth / LOGO_ASPECT);
  const logoLeft   = Math.round((width - logoWidth) / 2);
  const metaY      = height - padBottom;
  const logoGapBelow = Math.round(base * 0.018);
  const logoBottom = metaY - metaSize - logoGapBelow;
  const logoTop    = logoBottom - logoHeight;

  return {
    template: 'minimal-center',
    base, width, height,
    logo: { left: logoLeft, top: logoTop, width: logoWidth, height: logoHeight },
    headline: {
      x: centerX, y: headlineStartY, size: headlineSize,
      anchor: 'middle', weight: 700, lineHeight: 1.03, lines: headlineLines,
      letterSpacing: -1
    },
    subtext: {
      x: centerX, y: subtextStartY, size: subtextSize,
      anchor: 'middle', weight: 400, lineHeight: 1.35, lines: subtextLines
    },
    tagline: null, // minimal layout skips the tagline on purpose
    meta: {
      x: centerX, y: metaY, size: metaSize,
      anchor: 'middle', letterSpacing: 1.2
    },
    gradient: {
      stops: [
        { offset: 0,   opacity: 0.35 },
        { offset: 30,  opacity: 0.10 },
        { offset: 70,  opacity: 0.10 },
        { offset: 100, opacity: 0.55 }
      ]
    }
  };
}

function buildOverlaySvg({ width, height, phone, website, fontFamily, layout, logoIsWhite }) {
  // Text colours flip with logo variant: on dark bg (white logo) use light text,
  // on light bg (dark logo) use dark text. The gradient uses the complementary
  // dark/light colour so text always sits on an appropriate backdrop.
  const headlineFill = logoIsWhite ? '#FFFFFF' : TLB_BRAND.dark900;
  const subtextFill  = logoIsWhite ? '#EAF0F7' : TLB_BRAND.slate700;
  const metaFill     = logoIsWhite ? '#FFFFFF' : TLB_BRAND.dark800;
  const taglineFill  = logoIsWhite ? TLB_BRAND.teal200 : TLB_BRAND.teal700;
  const gradStopColor = logoIsWhite ? TLB_BRAND.dark900 : '#FFFFFF';

  const gradientStopsSvg = layout.gradient.stops.map(s =>
    `      <stop offset="${s.offset}%" stop-color="${gradStopColor}" stop-opacity="${s.opacity}"/>`
  ).join('\n');

  const { headline, subtext, tagline, meta } = layout;

  const headlineTspans = headline.lines.map((line, i) =>
    `<tspan x="${headline.x}" dy="${i === 0 ? 0 : Math.round(headline.size * headline.lineHeight)}">${escapeXml(line)}</tspan>`
  ).join('');

  const subtextTspans = subtext.lines.map((line, i) =>
    `<tspan x="${subtext.x}" dy="${i === 0 ? 0 : Math.round(subtext.size * subtext.lineHeight)}">${escapeXml(line)}</tspan>`
  ).join('');

  const taglineSvg = tagline ? `
  <text x="${tagline.x}" y="${tagline.y}"
        font-family="${fontFamily}"
        font-size="${tagline.size}"
        font-weight="${tagline.weight}"
        fill="${taglineFill}"
        text-anchor="${tagline.anchor}"
        letter-spacing="${tagline.letterSpacing}">${escapeXml(tagline.text.toUpperCase())}</text>
  ` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="readGrad" x1="0" y1="0" x2="0" y2="1">
${gradientStopsSvg}
    </linearGradient>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#readGrad)"/>
  ${taglineSvg}
  <text x="${headline.x}" y="${headline.y}"
        font-family="${fontFamily}"
        font-size="${headline.size}"
        font-weight="${headline.weight}"
        fill="${headlineFill}"
        text-anchor="${headline.anchor}"
        letter-spacing="${headline.letterSpacing}">${headlineTspans}</text>

  <text x="${subtext.x}" y="${subtext.y}"
        font-family="${fontFamily}"
        font-size="${subtext.size}"
        font-weight="${subtext.weight}"
        fill="${subtextFill}"
        text-anchor="${subtext.anchor}">${subtextTspans}</text>

  <text x="${meta.x}" y="${meta.y}"
        font-family="${fontFamily}"
        font-size="${meta.size}"
        font-weight="500"
        fill="${metaFill}"
        fill-opacity="0.88"
        text-anchor="${meta.anchor}"
        letter-spacing="${meta.letterSpacing}">${escapeXml(website)}   •   ${escapeXml(phone)}</text>
</svg>`;
}

// Rasterise an SVG logo file to a PNG buffer at a target width, preserving aspect.
async function rasterizeLogo(logoPath, targetWidth) {
  return await sharp(logoPath, { density: 600 })
    .resize({ width: targetWidth, fit: 'inside' })
    .png()
    .toBuffer();
}

// Sample the average brightness of a region in an image buffer.
// Returns luminance 0..255 (Rec. 709 weights).
async function sampleLuminance(buffer, { left, top, width, height }) {
  const stats = await sharp(buffer)
    .extract({
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.max(1, width),
      height: Math.max(1, height)
    })
    .stats();
  const ch = stats.channels;
  // sharp stats gives R, G, B (and A) channels with .mean in 0..255
  return 0.2126 * ch[0].mean + 0.7152 * ch[1].mean + 0.0722 * ch[2].mean;
}

// ==================== MAIN POSTER BUILDER ====================
async function generatePoster({ occasion = 'custom', customPrompt = '', backgroundStyle = 'graphics', size = 'square', language = 'english', headline, subtext, tagline, template }) {
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

  // 2. Pick layout template. Random per generation unless the caller forces one
  //    (useful for smoke tests and for a future "lock layout" UI toggle).
  const chosenTemplate = LAYOUT_TEMPLATES.includes(template) ? template : pickRandomTemplate();

  // 3. Background image from Gemini
  const bgBuffer = await generateBackgroundImage({ occasion, customPrompt, backgroundStyle, size });

  // 4. Resize background to exact poster size
  const bgResized = await sharp(bgBuffer)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .toBuffer();

  // 5. Compute layout for the chosen template (wraps text, positions every block)
  const layout = computePosterLayout({
    width, height,
    template: chosenTemplate,
    headline: copy.headline,
    subtext: copy.subtext,
    tagline: copy.tagline
  });

  // 6. Decide logo variant based on raw bg luminance at the logo region.
  //    (We sample the raw bg, not the gradient-applied version, because the
  //    gradient direction itself depends on the choice we are trying to make.)
  const rawLuma = await sampleLuminance(bgResized, {
    left: layout.logo.left,
    top: layout.logo.top,
    width: layout.logo.width,
    height: layout.logo.height
  });
  // Bg is considered "light" if clearly bright. We skew slightly toward using
  // the white logo because our gradient darkens ambiguous regions.
  const useWhiteLogo = rawLuma < 170;

  // 7. Rasterise the chosen logo at the target pixel width
  const logoPath = useWhiteLogo ? LOGO_WHITE_PATH : LOGO_DARK_PATH;
  const logoBuffer = await rasterizeLogo(logoPath, layout.logo.width);

  // 8. Build the overlay SVG (gradient + text + meta line).
  const overlaySvg = buildOverlaySvg({
    width, height,
    phone: TLB_PHONE,
    website: TLB_WEBSITE,
    fontFamily: lang.font,
    layout,
    logoIsWhite: useWhiteLogo
  });

  // 9. Final composite: bg -> overlay -> logo
  const finalBuffer = await sharp(bgResized)
    .composite([
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      { input: logoBuffer, top: layout.logo.top, left: layout.logo.left }
    ])
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();

  return {
    buffer: finalBuffer,
    copy,
    size: sizeCfg,
    mimeType: 'image/png',
    logoVariant: useWhiteLogo ? 'white' : 'dark',
    template: chosenTemplate
  };
}

module.exports = {
  OCCASIONS, LANGUAGES, SIZES, BG_STYLES, TLB_BRAND,
  generatePoster, generatePosterCopy, generateBackgroundImage
};
