/* Dota2skins mod manager — renderer */
'use strict';

const RAW_BASE = 'https://dota2skins.vercel.app';

const CAT_RU = {
  heroes: 'Герои', 'item-effects': 'Эффекты предметов', 'hero-items': 'Предметы героев',
  backgrounds: 'Фоны меню', cursors: 'Курсоры', 'mega-kill': 'Мега-килл', shaders: 'Шейдеры',
  couriers: 'Курьеры', terrains: 'Ландшафты', creeps: 'Крипы', trees: 'Деревья', river: 'Река',
  'ti-bp-effects': 'Паки эффектов', emblems: 'Эмблемы', 'creep-deny': 'Денай крипов',
  music: 'Музыка', 'hero-sounds': 'Звуки героев', sounds: 'Звуки', 'ranged-attack': 'Дальние атаки',
  other: 'Разное', ranks: 'Ранги', 'item-icons': 'Иконки предметов', 'versus-screens': 'Versus Screen',
  announcers: 'Анонсеры', wards: 'Варды', pedestal: 'Пьедесталы', huds: 'HUD',
  herofx: 'Эффекты героев', pings: 'Пинги', packs: 'Versus Screen', optimization: 'Оптимизация',
  tormentor: 'Тормент', 'high-five': 'High Five', ancient: 'Древние', roshan: 'Рошан',
  towers: 'Башни', fonts: 'Шрифты', sites: 'Сайты', guides: 'Гайды', news: 'Новости',
};

const CAT_ICON = {
  all: 'apps', heroes: 'person', 'hero-items': 'swords', herofx: 'auto_fix_high',
  'hero-sounds': 'record_voice_over', terrains: 'landscape', trees: 'forest', river: 'water',
  creeps: 'bug_report', towers: 'cell_tower', roshan: 'skull', ancient: 'castle',
  tormentor: 'deployed_code', wards: 'visibility', couriers: 'pets', pedestal: 'podium',
  'creep-deny': 'block', shaders: 'palette', 'ti-bp-effects': 'auto_awesome',
  'item-effects': 'bolt', 'ranged-attack': 'my_location', 'high-five': 'waving_hand',
  backgrounds: 'wallpaper', huds: 'dashboard', emblems: 'military_tech',
  'versus-screens': 'compare_arrows', 'item-icons': 'category', ranks: 'workspace_premium',
  pings: 'notifications_active', cursors: 'arrow_selector_tool', fonts: 'text_fields',
  announcers: 'mic', 'mega-kill': 'campaign', music: 'music_note', sounds: 'volume_up',
  packs: 'compare_arrows', optimization: 'speed', other: 'widgets', guides: 'menu_book',
  sites: 'language', tools: 'build', news: 'newspaper',
};

// rail sections: [label, [categoryIds]]
const RAIL_SECTIONS = [
  ['Герои', ['heroes', 'hero-items', 'herofx', 'hero-sounds']],
  ['Мир', ['terrains', 'trees', 'river', 'creeps', 'towers', 'roshan', 'ancient', 'tormentor', 'wards', 'couriers', 'pedestal', 'creep-deny']],
  ['Эффекты', ['shaders', 'ti-bp-effects', 'item-effects', 'ranged-attack', 'high-five']],
  ['Интерфейс', ['backgrounds', 'huds', 'emblems', 'versus-screens', 'item-icons', 'ranks', 'pings', 'cursors', 'fonts']],
  ['Звук', ['announcers', 'mega-kill', 'music', 'sounds']],
  ['Прочее', ['packs', 'optimization', 'other', 'sites']],
];

const CATALOG_EXCLUDE = ['tools'];

const HERO_PREVIEW_FALLBACKS = {
  io: 'https://i.postimg.cc/SRq0t679/wisp-vert.jpg',
  anti_mage: 'https://i.postimg.cc/zGPrXR85/antimage-vert.jpg',
  lifestealer: 'https://i.postimg.cc/90p33DL0/life-stealer-vert.jpg',
  nature_prophet: 'https://i.postimg.cc/bv2KyCmn/furion-vert.jpg',
  necrophos: 'https://i.postimg.cc/d3JX9qw6/necrolyte-vert.jpg',
  windranger: 'https://i.postimg.cc/x1B44G9x/Windranger-icon.webp',
};

const SORTS = [
  { key: 'default', label: 'По умолчанию' },
  { key: 'date', label: 'Сначала новые' },
  { key: 'name', label: 'По имени А-Я' },
  { key: 'name-desc', label: 'По имени Я-А' },
];

const state = {
  view: 'catalog',
  catalog: null,
  settings: null,
  activeCategory: 'all',
  search: '',
  filters: { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '', heroSearch: '' },
  installedIndex: new Map(),
  installing: new Set(),
  modIndex: new Map(),
  authors: { selected: null, search: '', sort: 'default' },
};

const $ = (sel) => document.querySelector(sel);
const viewRoot = $('#view-root');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

function parseDateValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return num > 1e12 ? num : num * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fmtDate(value) {
  const ts = parseDateValue(value);
  if (ts === null) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getModDateValue(mod) {
  return mod?.meta?.date || mod?.createdAt || mod?.created_at || mod?.date || null;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function toast(msg, type = 'ok', ms = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type === 'ok' ? '' : type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function previewUrl(categoryId, preview) {
  if (!preview) return null;
  if (/^https?:\/\//i.test(preview)) return preview;
  if (/^file:\/\//i.test(preview)) return preview.replace(/^file:\/\//i, '');
  if (preview.startsWith('assets/previews/')) return `${RAW_BASE}/${preview.split('/').map(encodeURIComponent).join('/')}`;
  return `${RAW_BASE}/assets/previews/${encodeURIComponent(categoryId)}/${encodeURIComponent(preview)}`;
}

function resolveDownloadTarget(mod, style) {
  const candidates = [];
  const direct = style?.file || mod?.file || mod?.downloadUrl || mod?.downloadUrlOverride;
  if (direct) candidates.push(direct);
  if (Array.isArray(mod?.downloadOptions)) {
    for (const opt of mod.downloadOptions) {
      if (opt?.url) candidates.push(opt.url);
    }
  }
  if (Array.isArray(mod?.links)) {
    for (const link of mod.links) {
      if (link?.type === 'download' && link?.url) candidates.push(link.url);
      if ((link?.type === 'file' || link?.type === 'source') && link?.url) candidates.push(link.url);
    }
  }
  const picked = candidates.find((value) => typeof value === 'string' && value.trim());
  if (!picked) return null;
  if (/^https?:\/\//i.test(picked)) return picked;
  return `${RAW_BASE}/${picked.split('/').map(encodeURIComponent).join('/')}`;
}

function isVideo(src) { return /\.(mp4|webm)$/i.test(src || ''); }
function isAudio(src) { return /\.(mp3|wav|ogg)$/i.test(src || ''); }
function isMedia(src) { return isVideo(src) || isAudio(src); }

// resolve a repo-relative or absolute link to a full URL
function resolveUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${RAW_BASE}/${url.split('/').map(encodeURIComponent).join('/')}`;
}

function mediaHtml(url, { hoverPlay = false, autoplay = false, controls = false } = {}) {
  const normalizedUrl = typeof url === 'string' ? url.trim() : '';
  if (!normalizedUrl) {
    return `<div class="noimg"><span class="ms" style="font-size:36px">image</span></div>`;
  }
  if (isVideo(normalizedUrl)) {
    return `<video src="${esc(normalizedUrl)}" ${controls ? 'controls' : 'muted'} loop playsinline preload="${autoplay ? 'auto' : 'none'}" ${autoplay ? 'autoplay' : ''} ${hoverPlay ? 'data-hoverplay="1"' : ''}></video>`;
  }
  if (isAudio(normalizedUrl)) {
    return `<div class="audio-wrap"><span class="ms audio-icon">graphic_eq</span><audio src="${esc(normalizedUrl)}" controls preload="none"></audio></div>`;
  }
  return `<img src="${esc(normalizedUrl)}" loading="lazy" alt="">`;
}

// ---------- custom confirm dialog ----------

function confirmDialog(message, { okLabel = 'Удалить', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">Отмена</button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-c="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(false));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => done(true));
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-c="yes"]').focus();
  });
}

function authorUrl(name) {
  return state.catalog?.constants?.MOD_AUTHOR?.[name] || state.catalog?.constants?.MOD_SENDER?.[name] || null;
}

// media preview a mod can play in the built-in player: a "preview"-type link, or a video preview file
function modPreviewMedia(categoryId, mod) {
  const link = (mod.links || []).find((l) => l.type === 'preview' && isMedia(l.url));
  if (link) return resolveUrl(link.url);
  const p = mod.preview || mod.styles?.[0]?.preview;
  if (isMedia(p)) return previewUrl(categoryId, p);
  const direct = mod.preview || mod.imageUrl || mod.thumbnail;
  if (isMedia(direct)) return previewUrl(categoryId, direct);
  return null;
}

// ---------- built-in media player ----------

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function openPlayer(url, title) {
  const audio = isAudio(url);
  const overlay = document.createElement('div');
  overlay.className = 'player-overlay';
  overlay.innerHTML = `
    <div class="player-box ${audio ? 'audio' : ''}">
      ${audio
        ? `<div class="player-audio-visual"><span class="ms">graphic_eq</span></div><audio src="${esc(url)}" autoplay></audio>`
        : `<video src="${esc(url)}" autoplay playsinline></video>`}
      <div class="player-title">${esc(title || '')}</div>
      <button class="player-close" aria-label="Закрыть"><span class="ms">close</span></button>
      <div class="player-controls">
        <button class="pl-btn" data-act="play" aria-label="Пауза"><span class="ms">pause</span></button>
        <div class="pl-progress"><div class="pl-fill"></div><div class="pl-knob"></div></div>
        <span class="pl-time">0:00 / 0:00</span>
        <button class="pl-btn" data-act="mute" aria-label="Звук"><span class="ms">volume_up</span></button>
        ${audio ? '' : '<button class="pl-btn" data-act="fs" aria-label="На весь экран"><span class="ms">fullscreen</span></button>'}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const media = overlay.querySelector('video, audio');
  const box = overlay.querySelector('.player-box');
  const playBtn = overlay.querySelector('[data-act="play"] .ms');
  const muteBtn = overlay.querySelector('[data-act="mute"] .ms');
  const fill = overlay.querySelector('.pl-fill');
  const knob = overlay.querySelector('.pl-knob');
  const timeEl = overlay.querySelector('.pl-time');
  const progress = overlay.querySelector('.pl-progress');

  media.loop = true;

  const close = () => {
    media.pause();
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.player-close').addEventListener('click', close);

  const togglePlay = () => { media.paused ? media.play() : media.pause(); };
  overlay.querySelector('[data-act="play"]').addEventListener('click', togglePlay);
  media.addEventListener('play', () => { playBtn.textContent = 'pause'; });
  media.addEventListener('pause', () => { playBtn.textContent = 'play_arrow'; });
  if (!audio) media.addEventListener('click', togglePlay);

  media.addEventListener('timeupdate', () => {
    const pct = media.duration ? (media.currentTime / media.duration) * 100 : 0;
    fill.style.width = `${pct}%`;
    knob.style.left = `${pct}%`;
    timeEl.textContent = `${fmtTime(media.currentTime)} / ${fmtTime(media.duration)}`;
  });

  const seek = (e) => {
    const rect = progress.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (media.duration) media.currentTime = pct * media.duration;
  };
  progress.addEventListener('mousedown', (e) => {
    seek(e);
    const move = (ev) => seek(ev);
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  overlay.querySelector('[data-act="mute"]').addEventListener('click', () => {
    media.muted = !media.muted;
    muteBtn.textContent = media.muted ? 'volume_off' : 'volume_up';
  });
  const fsBtn = overlay.querySelector('[data-act="fs"]');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else box.requestFullscreen();
    });
  }
}

function keyOf(categoryId, name, styleLabel) {
  return `${categoryId}|${name}|${styleLabel || ''}`;
}

async function refreshInstalledIndex() {
  const { installed } = await window.api.mods.list();
  state.installedIndex.clear();
  for (const rec of installed) {
    state.installedIndex.set(keyOf(rec.categoryId, rec.name, rec.styleLabel), rec);
  }
  $('#libCount').textContent = installed.length || '';
}

// ---------- catalog data helpers ----------

// user-created packs live in localStorage
function customPacks() {
  try {
    return JSON.parse(localStorage.getItem('customPacks') || '[]');
  } catch {
    return [];
  }
}

function saveCustomPacks(packs) {
  localStorage.setItem('customPacks', JSON.stringify(packs));
}

function categoryMods(categoryId) {
  const data = state.catalog?.mods?.modsData?.[categoryId];
  if (!data) return [];
  if (Array.isArray(data)) {
    const mods = data.map((m) => ({ ...m, _group: null }));
    if (categoryId === 'packs') {
      for (const p of customPacks()) {
        mods.push({ name: p.name, type: 'pack', mods: p.mods, _group: null, _custom: true });
      }
    }
    return mods;
  }
  if (data.groups) {
    const out = [];
    for (const g of data.groups) {
      for (const m of g.mods || []) out.push({ ...m, _group: g.name, _groupId: g.id });
    }
    return out;
  }
  return [];
}

function isGrouped(categoryId) {
  const data = state.catalog?.mods?.modsData?.[categoryId];
  return !!(data && !Array.isArray(data) && data.groups);
}

function visibleCategories() {
  const cats = state.catalog?.constants?.categories || [];
  return cats
    .filter((c) => !CATALOG_EXCLUDE.includes(c.id))
    .map((c) => ({ ...c, _modsCount: categoryMods(c.id).length }))
    .sort((a, b) => b._modsCount - a._modsCount || (a.id || '').localeCompare(b.id || ''));
}

function buildModIndex() {
  state.modIndex.clear();
  for (const c of state.catalog?.constants?.categories || []) {
    for (const m of categoryMods(c.id)) {
      if (m.name) state.modIndex.set(m.name.toLowerCase(), { categoryId: c.id, mod: m });
    }
  }
}

function catName(id) {
  if (id === 'all') return 'Все категории';
  return CAT_RU[id] || state.catalog?.constants?.translations?.[id] || id;
}

function catIcon(id) { return CAT_ICON[id] || 'extension'; }

function resolveHeroPreview(hero) {
  const slug = (hero?.slug || hero?.id || '').toString().toLowerCase();
  const explicit = HERO_PREVIEW_FALLBACKS[slug];
  if (explicit) return explicit;
  const raw = hero?.preview || null;
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${RAW_BASE}/${raw.split('/').map(encodeURIComponent).join('/')}`;
}

function installTarget(mod) {
  const f = mod.file;
  if (!f) return null;
  if (/\.(vpk|zip)$/i.test(f)) return f;
  return null;
}

function tagLabel(categoryId, tag) {
  const cfg = state.catalog?.constants?.TAG_CONFIGS?.[categoryId];
  return cfg?.map?.[tag] || tag;
}

function isInstalled(categoryId, m) {
  return state.installedIndex.has(keyOf(categoryId, m.name, null)) ||
    (m.styles || []).some((s) => state.installedIndex.has(keyOf(categoryId, m.name, s.label)));
}

// ---------- filtering / sorting ----------

function collectTags(mods) {
  const tags = new Map(); // tag -> count
  for (const m of mods) {
    for (const [k, v] of Object.entries(m.tags || {})) {
      if (v) tags.set(k, (tags.get(k) || 0) + 1);
    }
  }
  return [...tags.entries()].sort((a, b) => b[1] - a[1]);
}

function collectGroups(mods) {
  const seen = new Set();
  const out = [];
  for (const m of mods) {
    if (m._group && !seen.has(m._group)) {
      seen.add(m._group);
      out.push(m._group);
    }
  }
  return out;
}

function heroMatches(hero, name) {
  const re = new RegExp(`\\b${hero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(name);
}

function applyFilters(mods, catForInstalled) {
  const f = state.filters;
  let out = mods;
  if (f.group) out = out.filter((m) => m._group === f.group);
  if (f.hero) out = out.filter((m) => heroMatches(f.hero, m.name));
  if (f.tags.size) {
    out = out.filter((m) => [...f.tags].every((t) => m.tags?.[t]));
  }
  if (f.installedOnly) {
    out = out.filter((m) => isInstalled(m._cat || catForInstalled, m));
  }
  const dateOf = (m) => m.meta?.date || 0;
  switch (f.sort) {
    case 'date': out = [...out].sort((a, b) => dateOf(b) - dateOf(a)); break;
    case 'name': out = [...out].sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': out = [...out].sort((a, b) => b.name.localeCompare(a.name)); break;
  }
  return out;
}

// ---------- window controls ----------

$('#winMin')?.addEventListener('click', () => window.api.win.minimize());
$('#winClose')?.addEventListener('click', () => window.api.win.close());

// ---------- navigation ----------

document.querySelectorAll('.tb-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  closeModal();
  closeSlotModals();
  document.querySelectorAll('.tb-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  state.view = view;
  $('#catRail').classList.toggle('hidden', view !== 'catalog');
  render();
}

$('#openModsFolderBtn').addEventListener('click', async () => {
  const r = await window.api.misc.openLangFolder();
  if (r.error) toast(r.error, 'error');
});

$('#launchDotaBtn').addEventListener('click', async () => {
  const r = await window.api.misc.launchDota();
  if (r?.error) toast(r.error, 'warn');
});

// global search
let searchTimer = null;
$('#globalSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value;
    $('#clearSearch').classList.toggle('hidden', !state.search);
    if (state.view !== 'catalog') switchView('catalog');
    else renderCatalog();
  }, 180);
});
$('#clearSearch').addEventListener('click', () => {
  $('#globalSearch').value = '';
  state.search = '';
  $('#clearSearch').classList.add('hidden');
  if (state.view === 'catalog') renderCatalog();
});

// ---------- views ----------

function render() {
  switch (state.view) {
    case 'catalog': return renderCatalog();
    case 'library': return renderLibrary();
    case 'presets': return renderPresets();
    case 'authors': return renderAuthors();
    case 'tools': return renderTools();
    case 'settings': return renderSettings();
  }
}

// ===== Category rail =====

function renderRail() {
  const rail = $('#catRail');
  const sortedCats = visibleCategories();
  const cats = new Set(sortedCats.map((c) => c.id));
  const catOrder = new Map(sortedCats.map((c, index) => [c.id, index]));
  let html = `
    <button class="rail-item ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
      <span class="ms">apps</span>Все категории
    </button>`;
  for (const [, ids] of RAIL_SECTIONS) {
    const present = ids.filter((id) => cats.has(id)).sort((a, b) => (catOrder.get(a) ?? 9999) - (catOrder.get(b) ?? 9999));
    if (!present.length) continue;
    for (const id of present) {
      html += `
        <button class="rail-item ${state.activeCategory === id ? 'active' : ''}" data-cat="${esc(id)}">
          <span class="ms">${catIcon(id)}</span>${esc(catName(id))}
          <span class="rail-cnt">${categoryMods(id).length}</span>
        </button>`;
    }
  }
  rail.innerHTML = html;
  rail.querySelectorAll('.rail-item').forEach((b) => {
    b.addEventListener('click', () => {
      state.activeCategory = b.dataset.cat;
      state.filters = { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '', heroSearch: '' };
      if (state.search) {
        state.search = '';
        $('#globalSearch').value = '';
        $('#clearSearch').classList.add('hidden');
      }
      renderCatalog();
    });
  });
}

// ===== Catalog =====

function renderCatalog() {
  if (!state.catalog) {
    viewRoot.innerHTML = `<div class="empty-note">Загрузка каталога…</div>`;
    return;
  }
  if (state.catalog.error) {
    viewRoot.innerHTML = `
      <div class="empty-note">
        Не удалось загрузить каталог: ${esc(state.catalog.error)}<br><br>
        <button class="btn btn-primary" id="retryCat">Повторить</button>
      </div>`;
    $('#retryCat').addEventListener('click', () => loadCatalog(true));
    return;
  }

  renderRail();

  const searching = state.search.trim().length > 0;
  if (searching) return renderSearchResults();
  if (state.activeCategory === 'all') return renderHome();
  renderCategory(state.activeCategory);
}

// --- home (all categories) ---

function renderHome() {
  const cats = visibleCategories();
  const recent = (state.catalog.mods.recentlyAddedMods || [])
    .map((r) => {
      const hit = state.modIndex.get(r.name.toLowerCase());
      return hit && hit.categoryId === (r.category === 'effects-packs' ? 'ti-bp-effects' : r.category)
        ? { ...hit.mod, _cat: hit.categoryId }
        : (state.modIndex.get(r.name.toLowerCase()) ? { ...state.modIndex.get(r.name.toLowerCase()).mod, _cat: state.modIndex.get(r.name.toLowerCase()).categoryId } : null);
    })
    .filter(Boolean)
    .slice(0, 12);

  viewRoot.innerHTML = `
    <div class="home-hero">
      <h1>Моды для Dota 2</h1>
      <p>${cats.reduce((n, c) => n + categoryMods(c.id).length, 0)} модов в ${cats.length} категориях${state.catalog.fetchedAt ? ' · обновлён ' + new Date(state.catalog.fetchedAt).toLocaleDateString('ru') : ''}</p>
    </div>
    ${recent.length ? `
      <div class="section-h"><span class="ms">new_releases</span>Недавно добавленные</div>
      <div class="recent-row">${recent.map((m, i) => cardHtml(m, i, true)).join('')}</div>` : ''}
    <div class="section-h"><span class="ms">apps</span>Категории</div>
    <div class="cat-tiles">
        ${cats.map((c, i) => {
          const prev = c.preview ? previewUrl(c.id, c.preview) : null;
          return `
          <div class="cat-tile" data-cat="${esc(c.id)}" style="--i:${Math.min(i, 24)}">
            ${prev ? mediaHtml(prev) : ''}
            <div class="ct-shade"></div>
            <div class="ct-label">
              <span class="ct-name">${esc(catName(c.id))}</span>
              <span class="ct-cnt">${categoryMods(c.id).length}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
  `;

  viewRoot.querySelectorAll('.cat-tile').forEach((t) => {
    t.addEventListener('click', () => {
      state.activeCategory = t.dataset.cat;
      state.filters = { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '', heroSearch: '' };
      renderCatalog();
      $('#main').scrollTop = 0;
    });
  });
  bindCards(viewRoot);
}

// --- search results ---

function renderSearchResults() {
  const q = state.search.trim().toLowerCase();
  const cats = visibleCategories();
  let mods = [];
  for (const c of cats) {
    for (const m of categoryMods(c.id)) {
      if (m.name && m.name.toLowerCase().includes(q)) mods.push({ ...m, _cat: c.id });
    }
  }
  mods = applyFilters(mods);

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Поиск: <span class="accent">${esc(state.search.trim())}</span></h1>
    </div>
    ${toolbarHtml(mods.length, { tags: [], groups: [] })}
    <div class="grid" id="modGrid">
      ${mods.length ? mods.map((m, i) => cardHtml(m, i, true)).join('') : `<div class="empty-note">Ничего не найдено</div>`}
    </div>
  `;
  bindToolbar();
  bindCards(viewRoot, mods);
}

// --- single category ---

const SLOT_LABELS = {
  set: 'Набор',
  default: 'Набор',
  head: 'Голова',
  headpiece: 'Голова',
  mask: 'Маска',
  shoulders: 'Плечи',
  back: 'Спина',
  cape: 'Плащ',
  legs: 'Ноги',
  boots: 'Ботинки',
  weapon: 'Оружие',
  offhand: 'Левая рука',
  arm: 'Рука',
  arms: 'Руки',
  body: 'Тело',
  chest: 'Грудь',
  waist: 'Пояс',
  pet: 'Питомец',
  tail: 'Хвост',
  item: 'Предмет',
  voice: 'Голос',
  misc: 'Разное',
  default: 'Набор',
};
const SLOT_ORDER = {
  set: 0,
  default: 0,
  head: 1,
  headpiece: 1,
  mask: 2,
  shoulders: 3,
  back: 4,
  cape: 5,
  body: 6,
  chest: 7,
  waist: 8,
  legs: 9,
  boots: 10,
  weapon: 11,
  offhand: 12,
  arm: 13,
  arms: 13,
  tail: 14,
  pet: 15,
  item: 16,
  voice: 17,
  misc: 18,
};
function translateSlot(slot) {
  const key = (slot || 'default').toString().trim().toLowerCase();
  return SLOT_LABELS[key] || slot || 'Набор';
}
function sortSlots(slots) {
  return [...new Set(slots.map((slot) => slot || 'default'))].sort((a, b) => {
    const aKey = (a || 'default').toString().trim().toLowerCase();
    const bKey = (b || 'default').toString().trim().toLowerCase();
    const order = (SLOT_ORDER[aKey] ?? 99) - (SLOT_ORDER[bKey] ?? 99);
    if (order !== 0) return order;
    return translateSlot(aKey).localeCompare(translateSlot(bKey), 'ru', { sensitivity: 'base' });
  });
}

function renderCategory(categoryId) {
  const all = categoryMods(categoryId).map((m) => ({ ...m, _cat: categoryId }));
  const tags = collectTags(all);
  const groups = isGrouped(categoryId) ? collectGroups(all) : [];
  const heroes = categoryId === 'heroes'
    ? (state.catalog?.constants?.HERO_CATALOG || []).filter((h) => (h.modsCount || 0) > 0)
    : [];
  const mods = applyFilters(all, categoryId);

  const grouped = isGrouped(categoryId) && !state.filters.group && state.filters.sort === 'default';

  let gridHtml = '';
  if (categoryId === 'heroes') {
    const selectedHero = state.filters.hero || '';
    const heroSearch = (state.filters.heroSearch || '').toLowerCase();
    const filteredHeroes = (heroSearch
      ? heroes.filter((h) => h.name.toLowerCase().includes(heroSearch))
      : heroes)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    
    if (selectedHero) {
      const heroEntry = heroes.find((h) => h.slug === selectedHero || h.name === selectedHero);
      const items = heroEntry ? all.filter((m) => (m.hero || '').toLowerCase() === heroEntry.slug.toLowerCase()) : [];
      const slots = sortSlots(items.map((m) => m.slot || 'default'));
      const slotCards = slots.map((slot) => {
        const slotMods = items.filter((m) => (m.slot || 'default') === slot);
        const modCount = slotMods.length;
        const slotTitle = translateSlot(slot);
        const firstPreview = slotMods.find((m) => m.preview || m.imageUrl)?.preview || slotMods.find((m) => m.preview || m.imageUrl)?.imageUrl || null;
        const previewHtml = firstPreview ? `<div class="hero-slot-media">${mediaHtml(previewUrl(categoryId, firstPreview), { hoverPlay: false })}</div>` : '';
        return `
          <div class="hero-slot-card" data-slot="${esc(slot)}">
            ${previewHtml}
            <div class="hero-slot-info">
              <div class="hero-slot-title">${esc(slotTitle)}</div>
            </div>
          </div>`;
      }).join('');
      gridHtml = `
        <div class="hero-detail">
          <button class="btn btn-ghost hero-back" id="heroBackBtn"><span class="ms">arrow_back</span>Назад к героям</button>
          <div class="hero-detail-title">${esc(heroEntry?.name || selectedHero)}</div>
          <div class="hero-slots-grid">${slotCards}</div>
        </div>`;
    } else if (!filteredHeroes.length) {
      gridHtml = '<div class="empty-note">Нет доступных героев</div>';
    } else {
      const heroCards = filteredHeroes.map((hero) => {
        const previewUrlValue = resolveHeroPreview(hero);
        const previewHtml = previewUrlValue ? `<div class="hero-card-media">${mediaHtml(previewUrl('heroes', previewUrlValue))}</div>` : '';
        return `
          <div class="card hero-card" data-hero="${esc(hero.slug)}">
            ${previewHtml}
            <div class="hero-card-content">
              <div class="hero-card-title">${esc(hero.name)}</div>
              <div class="hero-card-meta">${hero.modsCount || 0} ${plural(hero.modsCount || 0, 'мод', 'мода', 'модов')}</div>
            </div>
          </div>`;
      }).join('');
      gridHtml = `<div class="hero-grid">${heroCards}</div>`;
    }
  } else if (!mods.length) {
    gridHtml = '<div class="empty-note">Ничего не найдено — сбрось фильтры</div>';
  } else if (grouped) {
    let lastGroup = null;
    mods.forEach((m, i) => {
      if (m._group !== lastGroup) {
        gridHtml += `<div class="group-title">${esc(m._group)}</div>`;
        lastGroup = m._group;
      }
      gridHtml += cardHtml(m, i);
    });
  } else {
    gridHtml = mods.map((m, i) => cardHtml(m, i)).join('');
  }

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${esc(catName(categoryId))}</h1>
      <span class="view-sub">${all.length} ${plural(all.length, 'мод', 'мода', 'модов')}</span>
    </div>
    ${toolbarHtml(mods.length, { tags, groups, heroes, categoryId })}
    <div class="grid" id="modGrid">${gridHtml}</div>
  `;
  bindToolbar();
  if (categoryId === 'heroes') {
    const selectedHero = state.filters.hero || '';
    if (selectedHero) {
      const heroEntry = (state.catalog?.constants?.HERO_CATALOG || []).find((h) => h.slug === selectedHero || h.name === selectedHero);
      if (heroEntry) {
        const items = all.filter((m) => (m.hero || '').toLowerCase() === heroEntry.slug.toLowerCase());
        viewRoot.querySelectorAll('.hero-slot-card').forEach((card) => {
          card.addEventListener('click', () => {
            const slot = card.dataset.slot;
            const slotMods = items.filter((m) => (m.slot || 'default') === slot);
            openSlotModal(slot, slotMods, heroEntry.name, categoryId);
          });
        });
      }
      const backBtn = $('#heroBackBtn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          state.filters.hero = '';
          state.filters.heroSearch = '';
          renderCatalog();
        });
      }
    } else {
      viewRoot.querySelectorAll('.hero-card').forEach((card) => {
        card.addEventListener('click', () => {
          state.filters.hero = card.dataset.hero;
          renderCatalog();
        });
      });
    }
  } else {
    bindCards(viewRoot, mods);
  }
}

// --- hero slot modal ---

function closeSlotModals() {
  document.querySelectorAll('.slot-modal-overlay').forEach((overlay) => overlay.remove());
}

function openSlotModal(slot, mods, heroName, categoryId) {
  closeModal();
  closeSlotModals();
  const overlay = document.createElement('div');
  overlay.className = 'slot-modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">${esc(heroName)} — ${esc(translateSlot(slot))}</h2>
        <button class="modal-close" aria-label="Закрыть"><span class="ms">close</span></button>
      </div>
      <div class="modal-body">
        <div class="grid" id="slotModsGrid">
          ${mods.map((m, i) => cardHtml({ ...m, _cat: categoryId }, i, false)).join('')}
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  bindCards(overlay.querySelector('#slotModsGrid'), mods.map((m) => ({ ...m, _cat: categoryId })));
}

// --- toolbar ---

const GROUP_LABEL = { 'hero-items': 'Все герои', 'item-effects': 'Все предметы', creeps: 'Все крипы', towers: 'Все башни', 'creep-deny': 'Все типы' };

function toolbarHtml(resultCount, { tags = [], groups = [], heroes = [], categoryId = null }) {
  const f = state.filters;
  const isHeroes = categoryId === 'heroes';
  const toolbarParts = [];

  if (!isHeroes) {
    toolbarParts.push(`
      <div class="select-wrap">
        <span class="ms">sort</span>
        <select id="sortSelect">
          ${SORTS.map((s) => `<option value="${s.key}" ${f.sort === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>`);
  }

  if (isHeroes && !f.hero) {
    toolbarParts.push(`
      <div class="hero-search-wrap">
        <span class="ms">search</span>
        <input type="text" id="heroSearchInput" placeholder="Поиск героев..." value="${esc(f.heroSearch || '')}">
      </div>`);
  }

  if (!isHeroes && groups.length) {
    toolbarParts.push(`
      <div class="select-wrap">
        <span class="ms">${categoryId === 'hero-items' ? 'person' : catIcon(categoryId) || 'group'}</span>
        <select id="groupSelect">
          <option value="">${GROUP_LABEL[categoryId] || 'Все группы'}</option>
          ${groups.map((g) => `<option value="${esc(g)}" ${f.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
        </select>
      </div>`);
  }

  if (!isHeroes) {
    toolbarParts.push(`<div class="sep"></div>`);
    toolbarParts.push(`
      <button class="fchip ${f.installedOnly ? 'active' : ''}" id="installedChip">
        <span class="ms">check_circle</span>Установленные
      </button>`);
  }

  if (!isHeroes && tags.length) {
    toolbarParts.push(`<div class="sep"></div>`);
    toolbarParts.push(...tags.map(([tag, cnt]) => `
      <button class="fchip ${f.tags.has(tag) ? 'active' : ''}" data-tag="${esc(tag)}">
        ${esc(tagLabel(categoryId, tag))}<span style="opacity:.55">${cnt}</span>
      </button>`));
  }

  return `
    <div class="toolbar">
      ${toolbarParts.join('')}
      <span class="count">${resultCount} ${plural(resultCount, 'результат', 'результата', 'результатов')}</span>
    </div>`;
}

function bindToolbar() {
  $('#sortSelect')?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderCatalog();
  });
  $('#groupSelect')?.addEventListener('change', (e) => {
    state.filters.group = e.target.value;
    renderCatalog();
  });
  $('#heroSelect')?.addEventListener('change', (e) => {
    state.filters.hero = e.target.value;
    renderCatalog();
  });
  let heroSearchTimer = null;
  const heroSearchInput = $('#heroSearchInput');
  if (heroSearchInput) {
    heroSearchInput.addEventListener('input', (e) => {
      clearTimeout(heroSearchTimer);
      heroSearchTimer = setTimeout(() => {
        state.filters.heroSearch = e.target.value;
        renderCatalog();
      }, 180);
    });
    heroSearchInput.addEventListener('focus', () => {
      heroSearchInput.select();
    });
  }
  $('#installedChip')?.addEventListener('click', () => {
    state.filters.installedOnly = !state.filters.installedOnly;
    renderCatalog();
  });
  document.querySelectorAll('.fchip[data-tag]').forEach((c) => {
    c.addEventListener('click', () => {
      const t = c.dataset.tag;
      if (state.filters.tags.has(t)) state.filters.tags.delete(t);
      else state.filters.tags.add(t);
      renderCatalog();
    });
  });
}

// --- cards ---

function cardHtml(m, i, withCat = false) {
  const cat = m._cat;
  const previewCandidate = m.preview || m.imageUrl || m.thumbnail || (m.styles?.[0]?.preview);
  const prev = previewUrl(cat, previewCandidate);
  const installed = isInstalled(cat, m);
  const isPack = m.type === 'pack';
  const external = !installTarget(m) && !m.styles && !isPack;
  const tags = Object.entries(m.tags || {}).filter(([, v]) => v).map(([k]) => k).slice(0, 3);
  const author = (m.author || m.sender || '').trim();
  const hideAuthor = author && ['Unknown', 'Anonymous'].includes(author);
  const playable = modPreviewMedia(cat, m);
  const authorProfile = (state.catalog?.constants?.AUTHOR_PROFILES || []).find((entry) => entry.displayName.toLowerCase() === author.toLowerCase() || entry.id.toLowerCase() === author.toLowerCase());
  const authorAvatar = authorProfile?.avatarUrl ? `<img class="author-chip-avatar" src="${esc(authorProfile.avatarUrl)}" alt="${esc(author)}">` : '<span class="ms">person</span>';
  return `
    <div class="card" data-key="${esc(keyOf(cat, m.name, null))}" style="--i:${Math.min(i, 28)}">
      <div class="card-media">
        ${mediaHtml(prev, { hoverPlay: true })}
        <div class="media-tags">
          ${installed ? '<span class="mtag ok">Установлен</span>' : ''}
          ${isPack ? `<span class="mtag">Пак · ${(m.mods || []).length}</span>` : ''}
          ${m._custom ? '<span class="mtag custom">Свой</span>' : ''}
          ${external ? '<span class="mtag">Ссылка</span>' : ''}
          ${tags.map((t) => `<span class="mtag">${esc(tagLabel(cat, t))}</span>`).join('')}
        </div>
        ${playable ? `
          <button class="mtag-play" data-play="${esc(playable)}" data-title="${esc(m.name)}" aria-label="Смотреть превью">
            <span class="ms">play_arrow</span>Превью
          </button>` : ''}
        ${m.styles ? `
          <div class="media-swatches">
            ${m.styles.slice(0, 5).map((s) => `<span class="swatch-dot" style="background:${esc(s.color || '#a78bfa')}"></span>`).join('')}
          </div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${esc(m.name)}</div>
        <div class="card-meta">
          ${withCat ? '' : ''}
          ${getModDateValue(m) ? `<span>${fmtDate(getModDateValue(m))}</span>` : ''}
          ${author && !hideAuthor ? `<button class="author-chip ${authorProfile ? 'clickable' : ''}" data-author-id="${esc(authorProfile?.id || '')}" type="button">${authorAvatar}${esc(author)}</button>` : ''}
        </div>
      </div>
    </div>`;
}

function bindCards(root, modsList) {
  root.querySelectorAll('.card[data-key]').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.key;
      // find the mod by key among provided list or global index
      let target = null;
      if (modsList) {
        target = modsList.find((m) => keyOf(m._cat, m.name, null) === key);
      }
      if (!target) {
        const [cat, name] = key.split('|');
        target = findModByName(cat, name);
      }
      if (target) openModModal(target._cat, target);
    });
    const v = card.querySelector('video[data-hoverplay]');
    if (v) {
      card.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
      card.addEventListener('mouseleave', () => { v.pause(); });
    }
    const authorChip = card.querySelector('.author-chip.clickable');
    if (authorChip) {
      authorChip.addEventListener('click', (e) => {
        e.stopPropagation();
        const authorId = authorChip.dataset.authorId;
        if (authorId) {
          closeModal();
          closeSlotModals();
          state.authors = { selected: authorId };
          state.view = 'authors';
          render();
        }
      });
    }
    const playBtn = card.querySelector('.mtag-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlayer(playBtn.dataset.play, playBtn.dataset.title);
      });
    }
  });
}

function findModByName(cat, name) {
  if (cat === 'packs') {
    const custom = customPacks().find((p) => p.name === name);
    if (custom) return { ...custom, _cat: 'packs' };
  }
  const hit = state.modIndex.get(name.toLowerCase());
  return hit ? { ...hit.mod, _cat: hit.categoryId } : null;
}

// ---------- mod modal ----------

let modalState = null;

function openModModal(categoryId, mod) {
  closeSlotModals();
  modalState = { categoryId, mod, styleIdx: 0 };
  drawModal();
  $('#modalOverlay').classList.remove('hidden');
}

function closeModal() {
  $('#modalOverlay').classList.add('hidden');
  $('#modalContent').innerHTML = '';
  modalState = null;
}

$('#modalOverlay').addEventListener('click', (e) => {
  if (e.target === $('#modalOverlay')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

const LINK_LABEL = { preview: 'Превью', source: 'Источник', author: 'Автор', bug: 'Баг', guide: 'Гайд' };

function packMembers(mod) {
  return (mod.mods || []).map((name) => {
    const hit = state.modIndex.get(name.toLowerCase());
    return { name, hit };
  });
}

function drawModal() {
  const { categoryId, mod, styleIdx } = modalState;
  const styles = mod.styles || null;
  const cur = styles ? styles[styleIdx] : mod;
  const fileRef = styles ? cur.file : mod.file;
  const downloadTarget = resolveDownloadTarget(mod, styles ? cur : null);
  const target = downloadTarget && /\.(vpk|zip)$/i.test(downloadTarget) ? downloadTarget : null;
  const isPack = mod.type === 'pack';
  const styleLabel = styles ? cur.label : null;
  const installedRec = state.installedIndex.get(keyOf(categoryId, mod.name, styleLabel));
  const busy = state.installing.has(keyOf(categoryId, mod.name, styleLabel));
  const guide = mod.guideId && state.catalog?.guides?.[mod.guideId];

  const links = mod.links || [];
  const playable = modPreviewMedia(categoryId, { ...mod, preview: cur.preview || mod.preview });
  const mediaUrl = previewUrl(categoryId, cur.preview || mod.preview);

  // author: mod.author/sender field, or an "author"-type link whose url is a name or URL
  const authorLink = links.find((l) => l.type === 'author');
  const authorName = mod.author || mod.sender ||
    (authorLink && !/^https?:\/\//i.test(authorLink.url) ? authorLink.url : null);
  const authorHref = (authorLink && /^https?:\/\//i.test(authorLink.url) ? authorLink.url : null) ||
    (authorName ? authorUrl(authorName) : null);
  const hideAuthor = authorName && ['Unknown', 'Anonymous'].includes(authorName);
  const authorProfile = (state.catalog?.constants?.AUTHOR_PROFILES || []).find((entry) => entry.displayName.toLowerCase() === authorName?.toLowerCase() || entry.id.toLowerCase() === authorName?.toLowerCase());
  const authorAvatar = authorProfile?.avatarUrl ? `<img class="author-chip-avatar" src="${esc(authorProfile.avatarUrl)}" alt="${esc(authorName)}">` : '<span class="ms">person</span>';

  const otherLinks = links.filter((l) => !(l.type === 'preview' && isMedia(l.url)) && l.type !== 'author');

  // pack contents (with per-session exclusions)
  if (isPack && !modalState.packExcluded) modalState.packExcluded = new Set();
  const members = isPack ? packMembers(mod) : [];
  const activeCount = isPack ? members.filter((x) => !modalState.packExcluded.has(x.name)).length : 0;

  $('#modalContent').innerHTML = `
    <div class="modal-media">
      ${mediaHtml(mediaUrl, { autoplay: true })}
      <button class="modal-close" id="modalCloseBtn" aria-label="Закрыть"><span class="ms">close</span></button>
      ${playable ? `
        <button class="preview-toggle" id="previewPlayBtn">
          <span class="ms">play_circle</span>Смотреть превью
        </button>` : ''}
    </div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(mod.name)}</div>
      </div>
      <div class="modal-sub">
        <span>${esc(catName(categoryId))}</span>
        ${mod._group ? `<span>· ${esc(mod._group)}</span>` : ''}
        ${mod._custom ? '<span>· свой пак</span>' : ''}
        ${getModDateValue(mod) ? `<span>· ${fmtDate(getModDateValue(mod))}</span>` : ''}
        ${authorName && !hideAuthor ? `
          <button class="author-chip ${authorProfile ? 'clickable' : ''}" id="authorChip" ${authorProfile ? '' : 'disabled'} data-author-id="${esc(authorProfile?.id || '')}">
            ${authorAvatar}${esc(authorName)}${authorProfile ? '<span class="ms" style="font-size:11px">open_in_new</span>' : ''}
          </button>` : ''}
      </div>
      ${styles ? `
        <div class="style-row">
          ${styles.map((s, i) => `
            <button class="style-btn ${i === styleIdx ? 'active' : ''}" data-style="${i}">
              ${s.color ? `<span class="swatch" style="background:${esc(s.color)}"></span>` : ''}${esc(s.label)}
            </button>`).join('')}
        </div>` : ''}
      ${isPack ? `
        <div class="pack-list">
          ${members.map((x) => {
            const excluded = modalState.packExcluded.has(x.name);
            const thumb = x.hit ? previewUrl(x.hit.categoryId, x.hit.mod.preview || x.hit.mod.styles?.[0]?.preview) : null;
            const inst = x.hit && isInstalled(x.hit.categoryId, x.hit.mod);
            return `
            <div class="pack-row ${excluded ? 'excluded' : ''} ${x.hit ? '' : 'missing'}" data-member="${esc(x.name)}">
              ${thumb && !isVideo(thumb) ? `<img class="pack-thumb" src="${esc(thumb)}" loading="lazy" alt="">` : '<div class="pack-thumb"></div>'}
              <div class="pack-info">
                <div class="pack-mod-name">${esc(x.name)}</div>
                <div class="pack-mod-cat">${x.hit ? esc(catName(x.hit.categoryId)) : 'не найден в каталоге'}${inst ? ' · установлен' : ''}</div>
              </div>
              <button class="pack-x" data-toggle="${esc(x.name)}" aria-label="${excluded ? 'Вернуть' : 'Убрать'}">
                <span class="ms">${excluded ? 'add' : 'close'}</span>
              </button>
            </div>`;
          }).join('')}
        </div>
        <div class="pack-save-row">
          <input class="input" id="packSaveName" placeholder="Название своего пака…" value="${mod._custom ? esc(mod.name) : ''}">
          <button class="btn btn-sm" id="packSaveBtn"><span class="ms">bookmark_add</span>Сохранить пак</button>
          ${mod._custom ? `<button class="btn btn-sm btn-danger" id="packDeleteBtn">Удалить пак</button>` : ''}
        </div>` : ''}
      <div class="modal-actions">
        ${isPack ? `<button class="btn btn-primary" id="installPackBtn" ${activeCount ? '' : 'disabled'}><span class="ms">download</span>Установить пак (${activeCount})</button>` : ''}
        ${!isPack && target ? (installedRec
          ? `<button class="btn btn-danger" id="uninstallBtn"><span class="ms">delete</span>Удалить</button>`
          : `<button class="btn btn-primary" id="installBtn" ${busy ? 'disabled' : ''}><span class="ms">download</span>${busy ? 'Установка…' : 'Установить'}</button>`) : ''}
        ${!isPack && !target && downloadTarget ? `<button class="btn" id="openLinkBtn"><span class="ms">open_in_new</span>Открыть ссылку</button>` : ''}
      </div>
      ${otherLinks.length ? `
        <div class="modal-links">
          ${otherLinks.map((l) => `<a data-link="${links.indexOf(l)}">${esc(LINK_LABEL[l.type] || l.type || 'ссылка')}</a>`).join('')}
        </div>` : ''}
      ${categoryId === 'fonts' ? `<div class="modal-note">Шрифт ставится в файлы игры (game\\dota\\panorama\\fonts) — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
      ${categoryId === 'cursors' ? `<div class="modal-note">Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
    </div>
  `;

  $('#modalCloseBtn').addEventListener('click', closeModal);

  const previewPlay = $('#previewPlayBtn');
  if (previewPlay) {
    previewPlay.addEventListener('click', () => openPlayer(playable, mod.name));
  }

  const authorChip = $('#authorChip');
  if (authorChip) {
    authorChip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (authorChip.dataset.authorId) {
        closeModal();
        closeSlotModals();
        state.authors = { selected: authorChip.dataset.authorId };
        state.view = 'authors';
        render();
      } else if (authorHref) {
        window.api.misc.openExternal(authorHref);
      }
    });
  }

  // pack interactions
  document.querySelectorAll('.pack-x').forEach((b) => {
    b.addEventListener('click', () => {
      const n = b.dataset.toggle;
      if (modalState.packExcluded.has(n)) modalState.packExcluded.delete(n);
      else modalState.packExcluded.add(n);
      drawModal();
    });
  });
  const packSaveBtn = $('#packSaveBtn');
  if (packSaveBtn) {
    packSaveBtn.addEventListener('click', () => {
      const name = $('#packSaveName').value.trim();
      if (!name) { toast('Введи название пака', 'warn'); return; }
      const modNames = members.filter((x) => !modalState.packExcluded.has(x.name)).map((x) => x.name);
      if (!modNames.length) { toast('В паке не осталось модов', 'warn'); return; }
      const packs = customPacks().filter((p) => p.name !== name && p.name !== (mod._custom ? mod.name : null));
      packs.push({ name, mods: modNames });
      saveCustomPacks(packs);
      toast(`Пак «${name}» сохранён — он появился в категории Паки`);
      if (state.view === 'catalog' && state.activeCategory === 'packs') { closeModal(); renderCatalog(); }
    });
  }
  const packDeleteBtn = $('#packDeleteBtn');
  if (packDeleteBtn) {
    packDeleteBtn.addEventListener('click', async () => {
      if (!await confirmDialog(`Удалить пак «${mod.name}»?`)) return;
      saveCustomPacks(customPacks().filter((p) => p.name !== mod.name));
      closeModal();
      renderCatalog();
    });
  }

  document.querySelectorAll('.style-btn').forEach((b) => {
    b.addEventListener('click', () => {
      modalState.styleIdx = Number(b.dataset.style);
      drawModal();
    });
  });

  const installBtn = $('#installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => doInstall(categoryId, mod, styleLabel, fileRef, cur.preview || mod.preview));
  }
  const uninstallBtn = $('#uninstallBtn');
  if (uninstallBtn) {
    uninstallBtn.addEventListener('click', async () => {
      if (!await confirmDialog(`Удалить «${mod.name}»?`)) return;
      const r = await window.api.mods.remove(installedRec.id);
      if (r.error) toast(r.error, 'error');
      else toast(`${mod.name} удалён`);
      await refreshInstalledIndex();
      drawModal();
    });
  }
  const packBtn = $('#installPackBtn');
  if (packBtn) packBtn.addEventListener('click', () => installPack(mod));
  const openLinkBtn = $('#openLinkBtn');
  if (openLinkBtn) openLinkBtn.addEventListener('click', () => window.api.misc.openExternal(downloadTarget));
  const guideLink = $('#modalGuideLink');
  if (guideLink) {
    guideLink.remove();
  }
  otherLinks.forEach((l) => {
    const a = document.querySelector(`[data-link="${links.indexOf(l)}"]`);
    if (a) a.addEventListener('click', () => {
      const u = resolveUrl(l.url);
      if (u) window.api.misc.openExternal(u);
    });
  });
}

async function doInstall(categoryId, mod, styleLabel, fileRef, preview) {
  const k = keyOf(categoryId, mod.name, styleLabel);
  if (state.installing.has(k)) return;
  if (!state.settings?.dotaPathValid && categoryId !== 'tools') {
    toast('Сначала укажи путь к Dota 2 в настройках', 'warn');
    return;
  }
  state.installing.add(k);
  if (modalState) drawModal();
  const installTarget = resolveDownloadTarget(mod, styleLabel ? mod.styles?.find((s) => s.label === styleLabel) : null) || fileRef;
  const r = await window.api.mods.install({ categoryId, name: mod.name, styleLabel, fileRef: installTarget, preview });
  state.installing.delete(k);
  if (r.error && !r.already) toast(`${mod.name}: ${r.error}`, 'error', 6000);
  else if (!r.error) toast(`${mod.name} установлен`);
  await refreshInstalledIndex();
  if (modalState) drawModal();
  return r;
}

async function installPack(pack) {
  const excluded = modalState?.packExcluded || new Set();
  const names = (pack.mods || []).filter((n) => !excluded.has(n));
  closeModal();
  let ok = 0, fail = 0, skip = 0;
  for (const name of names) {
    const hit = state.modIndex.get(name.toLowerCase());
    if (!hit) { skip++; continue; }
    const { categoryId, mod } = hit;
    const fileRef = resolveDownloadTarget(mod, mod.styles?.[0]) || mod.file || mod.styles?.[0]?.file;
    const styleLabel = mod.file ? null : mod.styles?.[0]?.label || null;
    if (!fileRef || !/\.(vpk|zip)$/i.test(fileRef)) { skip++; continue; }
    if (state.installedIndex.has(keyOf(categoryId, mod.name, styleLabel))) { skip++; continue; }
    const r = await doInstall(categoryId, mod, styleLabel, fileRef, mod.preview);
    if (r?.ok) ok++; else fail++;
  }
  toast(`Пак «${pack.name}»: установлено ${ok}, пропущено ${skip}${fail ? `, ошибок ${fail}` : ''}`, fail ? 'warn' : 'ok', 7000);
  await refreshInstalledIndex();
  render();
}

// ===== Library =====

async function renderLibrary() {
  const { installed, external } = await window.api.mods.list();
  const enabledCount = installed.filter((m) => m.enabled).length;

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Библиотека</h1>
    </div>
    <div class="lib-toolbar">
      <span class="lib-stats">${installed.length} ${plural(installed.length, 'мод', 'мода', 'модов')} · ${enabledCount} включено</span>
      <button class="btn btn-sm" id="enableAllBtn">Включить всё</button>
      <button class="btn btn-sm" id="disableAllBtn">Отключить всё</button>
      <button class="btn btn-sm" id="openFolderBtn2"><span class="ms">folder_open</span>Папка модов</button>
    </div>
    <div class="lib-list" id="libList">
      ${installed.length ? '' : '<div class="empty-note">Пока ничего не установлено — загляни в Каталог</div>'}
    </div>
    ${external.length ? `
      <div class="section-h" style="margin-top:26px"><span class="ms">folder_zip</span>Внешние файлы в папке модов</div>
      <div style="color:var(--text-muted);font-size:12.5px;margin-bottom:10px">Файлы, установленные не через менеджер</div>
      <div class="lib-list" id="extList"></div>` : ''}
  `;

  const libList = $('#libList');
  installed.forEach((rec, i) => {
    const row = document.createElement('div');
    row.className = `lib-row ${rec.enabled ? '' : 'disabled'}`;
    row.style.setProperty('--i', Math.min(i, 20));
    const prev = previewUrl(rec.categoryId, rec.preview);
    const fileNames = rec.files.filter((f) => f.root === 'lang').map((f) => f.relPath);
    row.innerHTML = `
      ${prev && !isVideo(prev) ? `<img class="lib-thumb" src="${esc(prev)}" loading="lazy" alt="">` : `<div class="lib-thumb"></div>`}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)}${rec.styleLabel ? ` <span style="color:var(--primary-soft);font-size:12px">(${esc(rec.styleLabel)})</span>` : ''}</div>
        <div class="lib-meta">
          <span>${esc(catName(rec.categoryId))}</span>
          ${fileNames.length ? `<span>${esc(fileNames.slice(0, 3).join(', '))}${fileNames.length > 3 ? '…' : ''}</span>` : ''}
          <span>${new Date(rec.installedAt).toLocaleDateString('ru')}</span>
        </div>
      </div>
      <div class="lib-actions">
        ${['fonts', 'cursors'].includes(rec.categoryId)
          ? '<span style="font-size:11.5px;color:var(--text-muted)">всегда активен</span>'
          : `<button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${rec.id}" role="switch" aria-checked="${rec.enabled}" aria-label="Включить/выключить"></button>`}
        <button class="btn btn-sm btn-danger" data-del="${rec.id}">Удалить</button>
      </div>
    `;
    libList.appendChild(row);
  });

  libList.querySelectorAll('.toggle').forEach((t) => {
    t.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === t.dataset.id);
      const r = await window.api.mods.setEnabled(rec.id, !rec.enabled);
      if (r.error) toast(r.error, 'error');
      renderLibrary();
      refreshInstalledIndex();
    });
  });
  libList.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === b.dataset.del);
      if (!await confirmDialog(`Удалить «${rec.name}»?`)) return;
      const r = await window.api.mods.remove(rec.id);
      if (r.error) toast(r.error, 'error');
      else toast(`${rec.name} удалён`);
      renderLibrary();
      refreshInstalledIndex();
    });
  });

  $('#enableAllBtn').addEventListener('click', () => bulkToggle(installed, true));
  $('#disableAllBtn').addEventListener('click', () => bulkToggle(installed, false));
  $('#openFolderBtn2').addEventListener('click', () => window.api.misc.openLangFolder());

  if (external.length) {
    const extList = $('#extList');
    for (const f of external) {
      const row = document.createElement('div');
      row.className = `lib-row ${f.enabled ? '' : 'disabled'}`;
      row.innerHTML = `
        <div class="lib-thumb"></div>
        <div class="lib-info">
          <div class="lib-name">${esc(f.name)}</div>
          <div class="lib-meta"><span>${fmtMB(f.size)} MB</span><span>внешний файл</span></div>
        </div>
        <div class="lib-actions">
          <button class="toggle ${f.enabled ? 'on' : ''}" data-ext="${esc(f.name)}" role="switch" aria-checked="${f.enabled}"></button>
          <button class="btn btn-sm btn-danger" data-extdel="${esc(f.name)}">Удалить</button>
        </div>
      `;
      extList.appendChild(row);
    }
    extList.querySelectorAll('.toggle').forEach((t) => {
      t.addEventListener('click', async () => {
        const f = external.find((x) => x.name === t.dataset.ext);
        await window.api.mods.externalSetEnabled(f.name, !f.enabled);
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-extdel]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!await confirmDialog(`Удалить файл ${b.dataset.extdel}?`)) return;
        await window.api.mods.externalRemove(b.dataset.extdel);
        renderLibrary();
      });
    });
  }
}

async function bulkToggle(installed, enabled) {
  for (const rec of installed) {
    if (['fonts', 'cursors'].includes(rec.categoryId)) continue;
    if (rec.enabled !== enabled) await window.api.mods.setEnabled(rec.id, enabled);
  }
  renderLibrary();
  refreshInstalledIndex();
}

// ===== Presets =====

async function renderPresets() {
  const presets = await window.api.presets.list();
  const { installed } = await window.api.mods.list();
  const byId = new Map(installed.map((m) => [m.id, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Пресеты</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
      Пресет запоминает, какие моды включены. Применение пресета включает его моды и выключает остальные.
    </div>
    <div class="preset-new">
      <input class="input" id="presetName" placeholder="Название пресета (напр. «Анимешный», «Минимал»)">
      <button class="btn btn-primary" id="savePresetBtn"><span class="ms">save</span>Сохранить текущее состояние</button>
    </div>
    <div id="presetList">
      ${presets.length ? '' : '<div class="empty-note">Пресетов пока нет</div>'}
    </div>
  `;

  const list = $('#presetList');
  presets.forEach((p, i) => {
    const names = p.modIds.map((id) => byId.get(id)?.name).filter(Boolean);
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.style.setProperty('--i', i);
    card.innerHTML = `
      <div class="preset-head">
        <div class="preset-name">${esc(p.name)}</div>
        <span style="font-size:12px;color:var(--text-muted)">${names.length} ${plural(names.length, 'мод', 'мода', 'модов')}</span>
        <button class="btn btn-sm btn-primary" data-apply="${p.id}">Применить</button>
        <button class="btn btn-sm btn-danger" data-pdel="${p.id}">Удалить</button>
      </div>
      <div class="preset-mods">${names.length ? esc(names.join(' · ')) : 'пусто (всё будет выключено)'}</div>
    `;
    list.appendChild(card);
  });

  $('#savePresetBtn').addEventListener('click', async () => {
    const name = $('#presetName').value.trim();
    if (!name) { toast('Введи название пресета', 'warn'); return; }
    await window.api.presets.save(name);
    toast(`Пресет «${name}» сохранён`);
    renderPresets();
  });

  list.querySelectorAll('[data-apply]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.apply(b.dataset.apply);
      if (r.error) toast(r.error, 'error', 6000);
      else toast('Пресет применён');
      refreshInstalledIndex();
    });
  });
  list.querySelectorAll('[data-pdel]').forEach((b) => {
    b.addEventListener('click', async () => {
      const p = presets.find((x) => x.id === b.dataset.pdel);
      if (!await confirmDialog(`Удалить пресет «${p?.name || ''}»?`)) return;
      await window.api.presets.delete(b.dataset.pdel);
      renderPresets();
    });
  });
}

// ===== Authors =====

function collectAuthors() {
  const mods = Object.values(state.catalog?.mods?.modsData || {})
    .flatMap((entry) => Array.isArray(entry) ? entry : (entry?.groups ? [] : []))
    .filter(Boolean);

  const allMods = [];
  for (const category of Object.values(state.catalog?.mods?.modsData || {})) {
    if (Array.isArray(category)) {
      allMods.push(...category);
    }
  }

  const authors = new Map();
  for (const mod of allMods) {
    const author = (mod.author || mod.authorName || '').toString().trim();
    if (!author) continue;
    const key = author.toLowerCase();
    if (!authors.has(key)) authors.set(key, { name: author, count: 0 });
    authors.get(key).count += 1;
  }

  return [...authors.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function getAuthorVisibleMods(author) {
  const mods = [...(author.mods || [])];
  const search = (state.authors?.search || '').trim().toLowerCase();
  const sort = state.authors?.sort || 'default';

  const filtered = search
    ? mods.filter((mod) => (mod.name || '').toLowerCase().includes(search))
    : mods;

  const withDate = filtered.map((mod) => ({
    ...mod,
    _dateValue: (() => {
      const raw = getModDateValue(mod);
      if (!raw) return null;
      const parsed = parseDateValue(raw);
      return parsed ? parsed / 1000 : null;
    })(),
  }));

  if (sort === 'date') {
    withDate.sort((a, b) => {
      const aDate = a._dateValue ?? 0;
      const bDate = b._dateValue ?? 0;
      return bDate - aDate;
    });
  } else if (sort === 'date-asc') {
    withDate.sort((a, b) => {
      const aDate = a._dateValue ?? 0;
      const bDate = b._dateValue ?? 0;
      return aDate - bDate;
    });
  } else if (sort === 'name') {
    withDate.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru', { sensitivity: 'base' }));
  } else if (sort === 'name-desc') {
    withDate.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'ru', { sensitivity: 'base' }));
  }

  return withDate.map(({ _dateValue, ...mod }) => mod);
}

function renderAuthorMods(author) {
  const mods = getAuthorVisibleMods(author);
  const grid = $('#authorModsGrid');
  const meta = $('.author-profile-meta');
  if (meta) {
    meta.textContent = `${mods.length} ${plural(mods.length, 'мод', 'мода', 'модов')}`;
  }
  if (!grid) return;
  grid.innerHTML = mods.length
    ? mods.map((m, i) => cardHtml({ ...m, _cat: m.categoryId || 'other' }, i, true)).join('')
    : '<div class="empty-note">У этого автора пока нет модов</div>';
  bindCards(viewRoot, mods.map((m) => ({ ...m, _cat: m.categoryId || 'other' })));
}

function renderAuthors() {
  const authors = state.catalog?.constants?.AUTHOR_PROFILES || [];
  const selectedAuthor = state.authors?.selected || null;

  if (selectedAuthor) {
    const author = authors.find((entry) => entry.id === selectedAuthor) || null;
    if (!author) {
      state.authors = { selected: null, search: '', sort: 'default' };
      return renderAuthors();
    }

    viewRoot.innerHTML = `
      <div class="view-header">
        <button class="btn btn-ghost" id="authorBackBtn"><span class="ms">arrow_back</span>Назад к авторам</button>
      </div>
      <div class="author-profile">
        <div class="author-profile-card">
          <div class="author-profile-avatar">${author.avatarUrl ? `<img src="${esc(author.avatarUrl)}" alt="${esc(author.displayName)}">` : '<span class="ms">person</span>'}</div>
          <div class="author-profile-info">
            <h1 class="view-title">${esc(author.displayName)}</h1>
            <div class="author-profile-meta"></div>
            <div class="author-links">
              ${Object.entries(author.links || {}).filter(([, url]) => url).map(([type, url]) => `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(type)}</a>`).join('')}
              ${author.authorLink ? `<a href="${esc(author.authorLink)}" target="_blank" rel="noreferrer">Сайт</a>` : ''}
            </div>
          </div>
        </div>
        <div class="author-profile-tools">
          <label class="author-profile-search" for="authorSearchInput">
            <span class="ms">search</span>
            <input class="input" id="authorSearchInput" placeholder="Поиск модов…" value="${esc(state.authors?.search || '')}">
          </label>
          <select class="input" id="authorSortSelect">
            <option value="default" ${state.authors?.sort === 'default' ? 'selected' : ''}>По умолчанию</option>
            <option value="date" ${state.authors?.sort === 'date' ? 'selected' : ''}>По дате новее</option>
            <option value="date-asc" ${state.authors?.sort === 'date-asc' ? 'selected' : ''}>По дате старше</option>
            <option value="name" ${state.authors?.sort === 'name' ? 'selected' : ''}>По названию от А-Я</option>
            <option value="name-desc" ${state.authors?.sort === 'name-desc' ? 'selected' : ''}>По названию от Я-А</option>
          </select>
        </div>
        <div class="grid" id="authorModsGrid"></div>
      </div>
    `;

    $('#authorBackBtn')?.addEventListener('click', () => {
      state.authors = { selected: null, search: '', sort: 'default' };
      renderAuthors();
    });
    $('#authorSearchInput')?.addEventListener('input', (e) => {
      state.authors = { ...state.authors, search: e.target.value };
      renderAuthorMods(author);
    });
    $('#authorSortSelect')?.addEventListener('change', (e) => {
      state.authors = { ...state.authors, sort: e.target.value };
      renderAuthorMods(author);
    });
    renderAuthorMods(author);
    return;
  }

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Авторы</h1></div>
    ${authors.length ? `
      <div class="tool-grid">
        ${authors.map((author, i) => `
          <div class="tool-card author-card" style="--i:${i}" data-author-id="${esc(author.id)}">
            <div class="author-card-avatar">${author.avatarUrl ? `<img src="${esc(author.avatarUrl)}" alt="${esc(author.displayName)}">` : '<span class="ms">person</span>'}</div>
            <div class="tool-name">${esc(author.displayName)}</div>
            <div style="color:var(--text-muted);font-size:12px">${author.mods.length} ${plural(author.mods.length, 'мод', 'мода', 'модов')}</div>
          </div>`).join('')}
      </div>` : '<div class="empty-note">Авторы не найдены</div>'}
  `;

  viewRoot.querySelectorAll('.author-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.authors = { selected: card.dataset.authorId, search: '', sort: 'default' };
      renderAuthors();
    });
  });
}

// ===== Tools =====

async function renderTools() {
  const tools = state.catalog?.mods?.modsData?.tools || [];
  const { installed } = await window.api.mods.list();
  const toolRecs = new Map(installed.filter((m) => m.categoryId === 'tools').map((m) => [m.name, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Инструменты</h1></div>
    <div class="tool-grid">
      ${tools.map((t, i) => {
        const dl = t.file && /\.(zip|exe)$/i.test(t.file);
        const rec = toolRecs.get(t.name);
        return `
        <div class="tool-card" style="--i:${i}">
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-actions">
            ${dl ? (rec
              ? `<button class="btn btn-sm btn-primary" data-run="${esc(rec.files[0]?.relPath || '')}"><span class="ms">play_arrow</span>Запустить</button>
                 <button class="btn btn-sm" data-open="${esc(rec.files[0]?.relPath || '')}">Папка</button>
                 <button class="btn btn-sm btn-danger" data-tdel="${rec.id}">Удалить</button>`
              : `<button class="btn btn-sm btn-primary" data-get="${i}"><span class="ms">download</span>Скачать</button>`)
              : (t.file ? `<button class="btn btn-sm" data-url="${esc(t.file)}"><span class="ms">open_in_new</span>Открыть сайт</button>` : '')}
            ${t.guideId && state.catalog?.guides?.[t.guideId] ? `<button class="btn btn-sm btn-ghost" data-guide="${esc(t.guideId)}">Гайд</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  viewRoot.querySelectorAll('[data-get]').forEach((b) => {
    b.addEventListener('click', async () => {
      const t = tools[Number(b.dataset.get)];
      b.disabled = true;
      b.textContent = 'Скачивание…';
      const r = await window.api.mods.install({ categoryId: 'tools', name: t.name, styleLabel: null, fileRef: t.file, preview: t.preview });
      if (r.error && !r.already) toast(`${t.name}: ${r.error}`, 'error', 6000);
      else toast(`${t.name} готов`);
      renderTools();
    });
  });
  viewRoot.querySelectorAll('[data-run]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.misc.runTool(b.dataset.run);
      if (r.error) toast(r.error, 'error');
    });
  });
  viewRoot.querySelectorAll('[data-open]').forEach((b) => {
    b.addEventListener('click', () => window.api.misc.openToolsFolder(b.dataset.open));
  });
  viewRoot.querySelectorAll('[data-tdel]').forEach((b) => {
    b.addEventListener('click', async () => {
      await window.api.mods.remove(b.dataset.tdel);
      renderTools();
    });
  });
  viewRoot.querySelectorAll('[data-url]').forEach((b) => {
    b.addEventListener('click', () => window.api.misc.openExternal(b.dataset.url));
  });
}

// ===== Guides =====

function renderGuideSteps(steps) {
  let html = '<ol>';
  for (const s of steps) {
    if (typeof s === 'string') {
      html += `<li>${s}</li>`; // guide content is trusted repo HTML (code/spans)
    } else if (s && s.text) {
      html += `</ol><div class="g-info ${s.icon === 'error' || s.icon === 'warning' ? 'g-warn' : ''}">${s.text}</div><ol>`;
    }
  }
  html += '</ol>';
  return html.replace(/<ol><\/ol>/g, '');
}

function renderGuides() {
  const guides = state.catalog?.guides || {};
  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Гайды</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      Гайды из репозитория Dota2PornFx. Менеджер делает бóльшую часть шагов автоматически — гайды пригодятся для ручной установки и решения проблем.
    </div>
    ${Object.entries(guides).map(([id, g]) => {
      const content = g.content?.ru || g.content?.en || [];
      return `
      <div class="guide-card" data-guide="${esc(id)}">
        <div class="guide-title">
          <span class="ms chev">chevron_right</span>
          ${esc(g.title)}
        </div>
        <div class="guide-body">
          ${content.map((block) => `
            ${block.info && block.infoPosition !== 'bottom' ? `<div class="g-info">${block.info}</div>` : ''}
            ${block.steps ? renderGuideSteps(block.steps) : ''}
            ${block.warning ? `<div class="g-info g-warn">${block.warning}</div>` : ''}
            ${block.info && block.infoPosition === 'bottom' ? `<div class="g-info">${block.info}</div>` : ''}
          `).join('')}
        </div>
      </div>`;
    }).join('')}
  `;

  viewRoot.querySelectorAll('.guide-title').forEach((t) => {
    t.addEventListener('click', () => t.closest('.guide-card').classList.toggle('open'));
  });
  viewRoot.querySelectorAll('.guide-body a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.misc.openExternal(a.href);
    });
  });
}

// ===== Settings =====

async function renderSettings() {
  const s = await window.api.settings.get();
  state.settings = s;
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = '1.0';

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Настройки</h1></div>

    <div class="settings-block">
      <h3>Путь к Dota 2</h3>
      <div class="settings-row">
        <span class="mono" style="flex:1">${esc(s.dotaGamePath || 'не найден')}</span>
        <span class="dot ${s.dotaPathValid ? 'ok' : 'bad'}"></span>
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="detectBtn">Найти автоматически</button>
        <button class="btn btn-sm" id="browseBtn">Указать вручную</button>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:60ms">
      <h3>Папка модов и параметры запуска</h3>
      <div class="settings-row">
        <span class="settings-label">Языковая папка</span>
        <div class="select-wrap">
          <span class="ms">folder</span>
          <select class="input" id="langSelect" style="padding-left:30px">
            ${['123', 'minify', 'russian', 'test'].map((v) => `<option value="${v}" ${s.langSuffix === v ? 'selected' : ''}>dota_${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">Параметр запуска Steam</span>
        <span class="launch-code">-language ${esc(s.langSuffix)}
          <button class="btn btn-sm" id="copyLaunchBtn">Копировать</button>
        </span>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        Steam → Библиотека → ПКМ по Dota 2 → Свойства → Параметры запуска → вставь строку выше.
        Моды (кроме шрифтов и курсоров) работают только с этим параметром.
      </div>
      <div class="modal-note" style="margin-top:10px">
        <b>Дота на русском?</b> Выбирай <code style="background:none;color:var(--primary-soft)">dota_russian</code> и параметр
        <code style="background:none;color:var(--primary-soft)">-language russian</code> — тогда игра останется русской.
        С <code style="background:none;color:var(--primary-soft)">-language 123</code> игра переключается на английский.
        При смене папки установленные моды переезжают автоматически.
      </div>
    </div>

    <div class="settings-block" style="animation-delay:120ms">
      <h3>Кэш загрузок</h3>
      <div class="settings-row">
        <span class="settings-label">Размер</span>
        <span style="font-variant-numeric:tabular-nums">${fmtMB(cacheSize)} MB</span>
        <button class="btn btn-sm" id="clearCacheBtn">Очистить</button>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        Скачанные архивы модов. Нужны для быстрой переустановки — удаление ничего не сломает.
      </div>
    </div>

    <div class="settings-block" style="animation-delay:180ms">
      <h3>Каталог</h3>
      <div class="settings-row">
        <span class="settings-label">Обновлён</span>
        <span>${state.catalog?.fetchedAt ? new Date(state.catalog.fetchedAt).toLocaleString('ru') : '—'}</span>
        <button class="btn btn-sm" id="refreshCatBtn2">Обновить сейчас</button>
      </div>
      <div class="settings-row">
        <span class="settings-label">Источник</span>
        <a style="color:var(--primary-soft);cursor:pointer;font-size:12.5px" id="srcLink">dota2skins.vercel.app</a>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:240ms">
      <h3>О программе</h3>
      <div class="settings-row">
        <span class="settings-label">Версия</span>
        <span style="font-variant-numeric:tabular-nums">${esc(appVersion)}</span>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        Обновления скачиваются автоматически из GitHub Releases — когда новая версия готова, появится кнопка установки.
      </div>
    </div>
  `;
  $('#detectBtn').addEventListener('click', async () => {
    const found = await window.api.settings.detectDota();
    if (found) toast('Dota 2 найдена: ' + found);
    else toast('Не нашёл автоматически — укажи вручную', 'warn');
    renderSettings();
    refreshSidebarStatus();
  });
  $('#browseBtn').addEventListener('click', async () => {
    const r = await window.api.settings.browseDota();
    if (r?.error) toast(r.error, 'error');
    if (r?.path) toast('Путь сохранён');
    renderSettings();
    refreshSidebarStatus();
  });
  $('#langSelect').addEventListener('change', async (e) => {
    await window.api.settings.set('langSuffix', e.target.value);
    toast(`Папка модов: dota_${e.target.value}. Не забудь сменить параметр запуска!`, 'warn', 6000);
    renderSettings();
    refreshSidebarStatus();
  });
  $('#copyLaunchBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(`-language ${s.langSuffix}`);
    toast('Скопировано в буфер');
  });
  $('#clearCacheBtn').addEventListener('click', async () => {
    await window.api.misc.clearCache();
    toast('Кэш очищен');
    renderSettings();
  });
  $('#refreshCatBtn2').addEventListener('click', async () => {
    await loadCatalog(true);
    renderSettings();
  });
  $('#srcLink').addEventListener('click', () => window.api.misc.openExternal('https://dota2skins.vercel.app/'));
}

// ---------- status bar ----------

async function refreshSidebarStatus() {
  const s = await window.api.settings.get();
  state.settings = s;
  const dotEl = $('#dotaStatusDot');
  const txtEl = $('#dotaStatusText');
  if (s.dotaPathValid) {
    dotEl.className = 'dot ok';
    txtEl.textContent = `Dota 2 подключена · dota_${s.langSuffix} · параметр: -language ${s.langSuffix}`;
  } else {
    dotEl.className = 'dot bad';
    txtEl.textContent = 'Dota 2 не найдена — укажи путь в настройках';
  }
}

// ---------- progress ----------

let progressHideTimer = null;
window.api.onProgress((evt) => {
  const bar = $('#progressBar');
  if (evt.type === 'download') {
    bar.classList.remove('hidden');
    $('#progressLabel').textContent = `Скачивание: ${evt.label}`;
    if (evt.total > 0) {
      $('#progressSize').textContent = `${fmtMB(evt.loaded)} / ${fmtMB(evt.total)} MB`;
      $('#progressFill').style.width = `${(evt.loaded / evt.total) * 100}%`;
    } else {
      $('#progressSize').textContent = `${fmtMB(evt.loaded)} MB`;
      $('#progressFill').style.width = '40%';
    }
    clearTimeout(progressHideTimer);
  } else if (evt.type === 'stage') {
    $('#progressLabel').textContent = `${evt.label}: ${evt.stage}`;
    $('#progressFill').style.width = '95%';
  } else if (evt.type === 'done' || evt.type === 'error') {
    $('#progressFill').style.width = '100%';
    clearTimeout(progressHideTimer);
    progressHideTimer = setTimeout(() => bar.classList.add('hidden'), 800);
  }
});

// ---------- auto-update ----------

window.api.update.onUpdate((evt) => {
  if (evt.type === 'available') {
    toast(`Найдено обновление v${evt.version} — скачиваю в фоне…`, 'ok', 6000);
  } else if (evt.type === 'downloaded') {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = `
      <span class="ms">system_update_alt</span>
      <span>Обновление <b>v${esc(evt.version)}</b> готово к установке</span>
      <button class="btn btn-sm btn-primary" id="updateNowBtn">Перезапустить и обновить</button>
      <button class="btn btn-sm btn-ghost" id="updateLaterBtn">Позже</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#updateNowBtn').addEventListener('click', () => window.api.update.install());
    bar.querySelector('#updateLaterBtn').addEventListener('click', () => bar.remove());
  }
});

// ---------- boot ----------

async function loadCatalog(force = false) {
  if (force) toast('Обновляю каталог…');
  state.catalog = null;
  if (state.view === 'catalog') renderCatalog();
  state.catalog = await window.api.catalog.load(force);
  if (!state.catalog.error) buildModIndex();
  if (state.view === 'catalog') renderCatalog();
  if (force && !state.catalog.error) toast('Каталог обновлён');
}

(async function boot() {
  const maxed = await window.api.win.isMaximized();
  if (maxed) $('#winMax').innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="3.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.1" rx="1"/><path d="M4 3.5V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';
  await refreshSidebarStatus();
  await refreshInstalledIndex();
  await loadCatalog();
})();
