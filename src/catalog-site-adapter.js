const fs = require('fs');
const path = require('path');

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${url}`);
  return res.text();
}

function buildRawGithubUrl(repoRoot, branch, relativePath) {
  const repo = (repoRoot || '').replace(/\/$/, '');
  const rel = (relativePath || '').replace(/\\/g, '/').replace(/^\//, '');
  const rawRoot = repo.replace('https://github.com/', 'https://raw.githubusercontent.com/');
  const base = `${rawRoot}/${branch || 'main'}/`;
  return new URL(rel, base).toString();
}

async function readTextFromSource(source, relativePath = '') {
  if (!source) {
    throw new Error('Catalog source is required');
  }

  if (typeof source === 'string') {
    if (/^https?:\/\//.test(source)) {
      return fetchText(source);
    }
    return fs.readFileSync(path.join(source, relativePath), 'utf8');
  }

  if (source.siteRoot) {
    if (/^https?:\/\//.test(source.siteRoot)) {
      return fetchText(buildRawGithubUrl(source.siteRoot, source.branch || 'main', relativePath));
    }
    return fs.readFileSync(path.join(source.siteRoot, relativePath), 'utf8');
  }

  if (source.repoRoot) {
    return fetchText(buildRawGithubUrl(source.repoRoot, source.branch || 'main', relativePath));
  }

  if (source.dataUrl) {
    return fetchText(source.dataUrl);
  }

  if (source.fileUrl) {
    return fetchText(source.fileUrl);
  }

  throw new Error('Unsupported catalog source');
}

function parseStringValue(raw) {
  const text = (raw || '').trim();
  if (!text) return null;
  const cleaned = text.replace(/,$/, '').trim();
  if (!cleaned || cleaned === 'null') return null;
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    return cleaned.slice(1, -1);
  }
  return cleaned;
}

function formatHeroLabel(slug) {
  if (!slug) return 'Hero';
  return String(slug)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeCategoryId(id) {
  const raw = String(id || '').trim().toLowerCase();
  if (!raw) return 'other';
  const normalized = raw.replace(/[_\s]+/g, '-').replace(/-+/g, '-');
  const map = {
    'mega-kills': 'mega-kill',
    'mega_kills': 'mega-kill',
    'hero-sounds': 'hero-sounds',
    'hero_sounds': 'hero-sounds',
    'item-effects': 'item-effects',
    'item_effects': 'item-effects',
    'creep-deny': 'creep-deny',
    'creep_deny': 'creep-deny',
    'high-five': 'high-five',
    'high_five': 'high-five',
    'item-icons': 'item-icons',
    'item_icons': 'item-icons',
    'ranged-attack': 'ranged-attack',
    'ranged_attack': 'ranged-attack',
    interface: 'interface',
  };
  return map[normalized] || normalized;
}

async function loadHeroIcons(source) {
  const relativeHeroIconsPath = path.join('app', 'lib', 'heroes.ts');
  let text;

  try {
    text = await readTextFromSource(source, relativeHeroIconsPath);
  } catch {
    return {};
  }
  const blockMatch = text.match(/const\s+LOCAL_HERO_ICONS\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\n\};/m);
  if (!blockMatch) return {};

  const out = {};
  const regex = /^\s*([A-Za-z0-9_]+)\s*:\s*"([^"]+)"/gm;
  let match;
  while ((match = regex.exec(blockMatch[1]))) {
    out[match[1]] = match[2];
  }
  return out;
}

async function loadAuthorProfiles(source) {
  const relativeProfilesPath = path.join('app', 'lib', 'authors-profiles.ts');
  let text;

  try {
    text = await readTextFromSource(source, relativeProfilesPath);
  } catch {
    return [];
  }
  const match = text.match(/export const AUTHORS_PROFILES\s*(?::\s*[^=]+)?\s*=\s*\{([\s\S]*?)\n\};/m);
  if (!match) return [];

  const entries = [];
  const entryRegex = /\n\s*([A-Za-z0-9_]+)\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let entryMatch;
  while ((entryMatch = entryRegex.exec(match[1]))) {
    const [, key, body] = entryMatch;
    const profile = { id: key.toLowerCase(), displayName: key };
    const fieldRegex = /([A-Za-z]+)\s*:\s*(?:"([^"]+)"|'([^']+)')/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(body))) {
      const [, field, doubleQuoted, singleQuoted] = fieldMatch;
      const value = doubleQuoted || singleQuoted || '';
      if (field === 'id') profile.id = value.toLowerCase();
      else if (field === 'displayName') profile.displayName = value;
      else if (field === 'avatarUrl') profile.avatarUrl = value;
      else if (field === 'authorLink') profile.authorLink = value;
      else if (field === 'steam' || field === 'telegram' || field === 'youtube' || field === 'twitch' || field === 'github' || field === 'website' || field === 'discord') {
        profile[field] = value;
      }
    }
    entries.push(profile);
  }
  return entries;
}

async function loadSiteCatalog(source) {
  const relativeSourcePath = path.join('app', 'lib', 'hero-skins.ts');
  let text;

  try {
    text = await readTextFromSource(source, relativeSourcePath);
  } catch (err) {
    throw new Error(`Не удалось загрузить каталог сайта: ${err.message}`);
  }
  const lines = text.split(/\r?\n/);
  const modEntries = [];
  const heroEntries = [];
  const heroIcons = await loadHeroIcons(source);
  let inTargetSection = false;
  let currentSection = null;
  let currentObject = null;
  let currentHeroKey = null;
  let currentHeroObject = null;

  const flushObject = () => {
    if (currentObject) {
      const hasMeaningfulData = currentObject.name || currentObject.title || currentObject.id;
      if (hasMeaningfulData) {
        currentObject.hero = currentObject.hero || currentHeroKey || null;
        modEntries.push(currentObject);
      }
      currentObject = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes('export const HERO_MODS')) {
      inTargetSection = true;
      currentSection = 'hero';
      currentHeroKey = null;
      currentHeroObject = null;
      currentObject = null;
      continue;
    }
    if (trimmed.includes('export const OTHER_MODS')) {
      currentSection = 'other';
      currentHeroKey = null;
      currentHeroObject = null;
      currentObject = null;
      continue;
    }
    if (trimmed.includes('export const EXTRA_HIDDEN_SKIN_TITLES')) {
      inTargetSection = false;
      currentSection = null;
      flushObject();
      currentHeroKey = null;
      currentHeroObject = null;
      continue;
    }
    if (!inTargetSection || trimmed.startsWith('import ') || trimmed.startsWith('export type')) continue;

    const propertyMatch = trimmed.match(/^([A-Za-z0-9_$]+)\s*:\s*(.+)$/);
    const heroEntryMatch = trimmed.match(/^([A-Za-z0-9_$]+)\s*:\s*\[/);

    if (currentSection === 'hero' && heroEntryMatch && !currentObject) {
      const [, key] = heroEntryMatch;
      currentHeroKey = key.replace(/['"]/g, '');
      currentHeroObject = { slug: currentHeroKey, name: formatHeroLabel(currentHeroKey), items: [] };
      heroEntries.push(currentHeroObject);
      currentObject = {};
      continue;
    }

    if (trimmed === '{' || trimmed === '[{' || trimmed.endsWith('[{') || trimmed.includes('[{')) {
      currentObject = {};
      continue;
    }
    if (trimmed === '},' || trimmed === '}' || trimmed === '};' || trimmed === '}]' || trimmed === '},' || trimmed === '}] ,' || trimmed === '}]' || trimmed === '},') {
      flushObject();
      continue;
    }

    if (!currentObject) continue;
    if (!propertyMatch) continue;

    const [, key, valueText] = propertyMatch;
    if (key === 'id') {
      currentObject.id = parseStringValue(valueText);
      continue;
    }
    if (key === 'title') {
      currentObject.name = parseStringValue(valueText);
      continue;
    }
    if (key === 'author') {
      currentObject.author = parseStringValue(valueText);
      continue;
    }
    if (key === 'category') {
      currentObject.category = parseStringValue(valueText);
      continue;
    }
    if (key === 'hero') {
      currentObject.hero = parseStringValue(valueText);
      continue;
    }
    if (key === 'imageUrl') {
      currentObject.preview = parseStringValue(valueText);
      continue;
    }
    if (key === 'invokerSlot') {
      currentObject.slot = parseStringValue(valueText);
      continue;
    }
    if (key === 'downloadUrl') {
      currentObject.file = parseStringValue(valueText);
      continue;
    }
    if (key === 'createdAt') {
      currentObject.createdAt = parseStringValue(valueText);
      continue;
    }
  }

  const grouped = {};
  const heroNames = [];
  const hiddenTitles = new Set([
    'patcher - weather & more',
    'patcher - weather and more',
  ]);
  for (const entry of modEntries) {
    if (!entry?.name && !entry?.id) continue;
    const title = (entry.name || entry.title || entry.id || '').toString().trim().toLowerCase();
    if (hiddenTitles.has(title)) continue;
    const cat = normalizeCategoryId(entry.category || 'other');
    if (!grouped[cat]) grouped[cat] = [];
    const heroSlug = entry.hero || currentHeroKey || null;
    const heroLabel = heroSlug ? formatHeroLabel(heroSlug) : null;
    if (heroSlug && !heroNames.includes(heroLabel)) heroNames.push(heroLabel);
    const normalized = {
      name: entry.name || entry.title || entry.id,
      author: entry.author || 'Unknown',
      preview: entry.preview || null,
      file: entry.file || null,
      createdAt: entry.createdAt || null,
      categoryId: cat,
      hero: heroSlug,
      heroLabel,
      slot: entry.slot || null,
    };
    grouped[cat].push(normalized);
    if (cat === 'heroes') {
      if (!grouped.heroesByHero) grouped.heroesByHero = {};
      if (!grouped.heroesByHero[heroSlug]) grouped.heroesByHero[heroSlug] = [];
      grouped.heroesByHero[heroSlug].push(normalized);
    }
  }

  const categoryPreviewMap = {};
  for (const [cat, mods] of Object.entries(grouped)) {
    if (cat === 'heroesByHero') continue;
    const preview = mods.find((m) => m.preview)?.preview || null;
    if (preview) categoryPreviewMap[cat] = preview;
  }

  const heroCatalog = heroEntries.map((hero) => {
    const heroSlug = hero.slug;
    const heroPreview = heroIcons[heroSlug] || (heroSlug ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroSlug}.png` : null);
    const heroMods = (grouped.heroes || []).filter((m) => (m.hero || '').toLowerCase() === heroSlug.toLowerCase());
    return {
      id: hero.slug,
      name: hero.name,
      slug: hero.slug,
      preview: heroPreview,
      modsCount: heroMods.length,
      slots: [...new Set(heroMods.map((m) => m.slot || 'default').filter(Boolean))],
    };
  });

  const categories = Object.keys(grouped)
    .filter((id) => id !== 'heroesByHero')
    .map((id) => ({ id, label: id, preview: categoryPreviewMap[id] || null }));

  const authorProfiles = await loadAuthorProfiles(source);
  const authorMods = new Map();
  for (const mod of Object.values(grouped).flat()) {
    const author = (mod.author || '').toString().trim();
    if (!author) continue;
    const key = author.toLowerCase();
    if (!authorMods.has(key)) authorMods.set(key, []);
    authorMods.get(key).push(mod);
  }

  const authorEntries = authorProfiles.map((profile) => {
    const key = (profile.displayName || profile.id || '').toString().trim().toLowerCase();
    const mods = (authorMods.get(key) || []).map((mod) => ({ ...mod, categoryId: normalizeCategoryId(mod.categoryId || mod.category || 'other') }));
    return {
      ...profile,
      id: profile.id || key,
      displayName: profile.displayName || profile.id || key,
      avatarUrl: profile.avatarUrl || null,
      authorLink: profile.authorLink || null,
      links: {
        steam: profile.steam || null,
        telegram: profile.telegram || null,
        youtube: profile.youtube || null,
        twitch: profile.twitch || null,
        github: profile.github || null,
        website: profile.website || null,
        discord: profile.discord || null,
      },
      mods,
    };
  });

  const hiddenNames = new Set(['anonymous', 'unknown']);
  const visibleAuthors = authorEntries.filter((profile) => !hiddenNames.has((profile.displayName || '').toLowerCase()))
    .sort((a, b) => (b.mods.length - a.mods.length) || a.displayName.localeCompare(b.displayName));

  return {
    mods: {
      modsData: grouped,
      recentlyAddedMods: Object.values(grouped).flat().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 40),
    },
    constants: {
      categories,
      translations: {},
      HEROES_LIST: heroNames,
      HERO_CATALOG: heroCatalog,
      TAG_CONFIGS: {},
      MOD_AUTHOR: {},
      MOD_SENDER: {},
      AUTHOR_PROFILES: visibleAuthors,
    },
    guides: {},
  };
}

module.exports = { loadSiteCatalog };