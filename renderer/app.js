/* Dota 2 Mod Manager — renderer */
'use strict';

const RAW_BASE = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';

const CAT_RU = {
  heroes: 'Герои', 'item-effects': 'Эффекты предметов', 'hero-items': 'Предметы героев',
  backgrounds: 'Фоны меню', cursors: 'Курсоры', 'mega-kill': 'Мега-килл', shaders: 'Шейдеры',
  couriers: 'Курьеры', terrains: 'Ландшафты', creeps: 'Крипы', trees: 'Деревья', river: 'Река',
  'ti-bp-effects': 'Паки эффектов', emblems: 'Эмблемы', 'creep-deny': 'Денай крипов',
  music: 'Музыка', 'hero-sounds': 'Звуки героев', sounds: 'Звуки', 'ranged-attack': 'Дальние атаки',
  other: 'Разное', ranks: 'Ранги', 'item-icons': 'Иконки предметов', 'versus-screens': 'Экраны Versus',
  announcers: 'Анонсеры', wards: 'Варды', pedestal: 'Пьедесталы', huds: 'HUD',
  herofx: 'Эффекты героев', pings: 'Пинги', packs: 'Паки', optimization: 'Оптимизация',
  tormentor: 'Тормент', 'high-five': 'High Five', ancient: 'Древние', roshan: 'Рошан',
  towers: 'Башни', fonts: 'Шрифты', sites: 'Сайты', guides: 'Гайды', news: 'Новости',
};

// categories not shown in the catalog grid (tools has its own view; news is not mods)
const CATALOG_EXCLUDE = ['tools', 'news'];

const state = {
  view: 'catalog',
  catalog: null,       // {mods, constants, guides, fetchedAt}
  settings: null,
  activeCategory: 'heroes',
  search: '',
  installedIndex: new Map(), // "cat|name|style" -> record
  installing: new Set(),
  modIndex: new Map(),  // name(lower) -> {categoryId, mod} for pack resolution
};

const $ = (sel) => document.querySelector(sel);
const viewRoot = $('#view-root');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
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
  if (preview.startsWith('assets/previews/')) return `${RAW_BASE}/${preview.split('/').map(encodeURIComponent).join('/')}`;
  return `${RAW_BASE}/assets/previews/${encodeURIComponent(categoryId)}/${encodeURIComponent(preview)}`;
}

function isVideo(src) {
  return /\.(mp4|webm)$/i.test(src || '');
}

function mediaHtml(url, { hoverPlay = false, autoplay = false } = {}) {
  if (!url) {
    return `<div class="noimg"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>`;
  }
  if (isVideo(url)) {
    return `<video src="${esc(url)}" muted loop playsinline preload="${autoplay ? 'auto' : 'none'}" ${autoplay ? 'autoplay' : ''} ${hoverPlay ? 'data-hoverplay="1"' : ''}></video>`;
  }
  return `<img src="${esc(url)}" loading="lazy" alt="">`;
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

function categoryMods(categoryId) {
  const data = state.catalog?.mods?.modsData?.[categoryId];
  if (!data) return [];
  if (Array.isArray(data)) return data.map((m) => ({ ...m, _group: null }));
  if (data.groups) {
    const out = [];
    for (const g of data.groups) {
      for (const m of g.mods || []) out.push({ ...m, _group: g.name });
    }
    return out;
  }
  return [];
}

function visibleCategories() {
  const cats = state.catalog?.constants?.categories || [];
  return cats.filter((c) => !CATALOG_EXCLUDE.includes(c.id) && categoryMods(c.id).length);
}

function buildModIndex() {
  state.modIndex.clear();
  for (const c of state.catalog?.constants?.categories || []) {
    for (const m of categoryMods(c.id)) {
      if (m.name) state.modIndex.set(m.name.toLowerCase(), { categoryId: c.id, mod: m });
      for (const s of m.styles || []) {
        // styles resolve by parent name; pack lists reference plain names
      }
    }
  }
}

function catName(id) {
  return CAT_RU[id] || state.catalog?.constants?.translations?.[id] || id;
}

// installable = has a downloadable file (vpk/zip), not just an external link
function installTarget(mod) {
  const f = mod.file;
  if (!f) return null;
  if (/\.(vpk|zip)$/i.test(f)) return f;
  return null;
}

// ---------- navigation ----------

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.dataset.view;
    render();
  });
});

$('#openModsFolderBtn').addEventListener('click', async () => {
  const r = await window.api.misc.openLangFolder();
  if (r.error) toast(r.error, 'error');
});

// ---------- views ----------

function render() {
  switch (state.view) {
    case 'catalog': return renderCatalog();
    case 'library': return renderLibrary();
    case 'presets': return renderPresets();
    case 'tools': return renderTools();
    case 'guides': return renderGuides();
    case 'settings': return renderSettings();
  }
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
    $('#retryCat').addEventListener('click', loadCatalog);
    return;
  }

  const cats = visibleCategories();
  const searching = state.search.trim().length > 0;

  let mods;
  if (searching) {
    const q = state.search.trim().toLowerCase();
    mods = [];
    for (const c of cats) {
      for (const m of categoryMods(c.id)) {
        if (m.name && m.name.toLowerCase().includes(q)) mods.push({ ...m, _cat: c.id });
      }
    }
  } else {
    mods = categoryMods(state.activeCategory).map((m) => ({ ...m, _cat: state.activeCategory }));
  }

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Каталог</h1>
      <span style="color:var(--text-muted);font-size:12.5px">${state.catalog.fetchedAt ? 'обновлён ' + new Date(state.catalog.fetchedAt).toLocaleString('ru') : ''}</span>
      <div class="spacer"></div>
      <div class="search-wrap">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input class="input" id="searchInput" placeholder="Поиск по всем модам…" value="${esc(state.search)}">
      </div>
      <button class="btn" id="refreshCatBtn" title="Скачать свежий каталог">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Обновить
      </button>
    </div>
    ${searching ? '' : `
      <div class="chips">
        ${cats.map((c) => `
          <button class="chip ${c.id === state.activeCategory ? 'active' : ''}" data-cat="${esc(c.id)}">
            ${esc(catName(c.id))}<span class="cnt">${categoryMods(c.id).length}</span>
          </button>`).join('')}
      </div>`}
    <div class="grid" id="modGrid">
      ${mods.length ? renderCards(mods, searching) : `<div class="empty-note">Ничего не найдено</div>`}
    </div>
  `;

  $('#searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderCatalog();
    const inp = $('#searchInput');
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  });
  $('#refreshCatBtn').addEventListener('click', () => loadCatalog(true));

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.activeCategory = chip.dataset.cat;
      renderCatalog();
    });
  });

  document.querySelectorAll('.card[data-idx]').forEach((card) => {
    card.addEventListener('click', () => {
      const m = mods[Number(card.dataset.idx)];
      openModModal(m._cat, m);
    });
  });

  // play video previews on hover
  viewRoot.querySelectorAll('video[data-hoverplay]').forEach((v) => {
    const card = v.closest('.card');
    card.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
    card.addEventListener('mouseleave', () => { v.pause(); });
  });
}

function renderCards(mods, searching) {
  let html = '';
  let lastGroup = null;
  mods.forEach((m, i) => {
    if (!searching && m._group && m._group !== lastGroup) {
      html += `<div class="group-title">${esc(m._group)}</div>`;
      lastGroup = m._group;
    }
    const cat = m._cat;
    const prev = previewUrl(cat, m.preview || (m.styles?.[0]?.preview));
    const installed = state.installedIndex.has(keyOf(cat, m.name, null)) ||
      (m.styles || []).some((s) => state.installedIndex.has(keyOf(cat, m.name, s.label)));
    const isPack = m.type === 'pack';
    const external = !installTarget(m) && !m.styles && !isPack;
    html += `
      <div class="card" data-idx="${i}">
        <div class="card-media">${mediaHtml(prev, { hoverPlay: true })}</div>
        <div class="card-body">
          <div class="card-name">${esc(m.name)}</div>
          <div class="card-tags">
            ${searching ? `<span class="tag">${esc(catName(cat))}</span>` : ''}
            ${installed ? '<span class="tag installed">Установлен</span>' : ''}
            ${m.styles ? `<span class="tag styles">${m.styles.length} ${plural(m.styles.length, 'стиль', 'стиля', 'стилей')}</span>` : ''}
            ${isPack ? `<span class="tag styles">Пак · ${(m.mods || []).length}</span>` : ''}
            ${external ? '<span class="tag">Ссылка</span>' : ''}
            ${Object.entries(m.tags || {}).filter(([, v]) => v).map(([k]) => `<span class="tag">${esc(k)}</span>`).join('')}
          </div>
        </div>
      </div>`;
  });
  return html;
}

// ---------- mod modal ----------

let modalState = null;

function openModModal(categoryId, mod) {
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

function drawModal() {
  const { categoryId, mod, styleIdx } = modalState;
  const styles = mod.styles || null;
  const cur = styles ? styles[styleIdx] : mod;
  const prev = previewUrl(categoryId, cur.preview || mod.preview);
  const fileRef = styles ? cur.file : mod.file;
  const target = fileRef && /\.(vpk|zip)$/i.test(fileRef) ? fileRef : null;
  const isPack = mod.type === 'pack';
  const styleLabel = styles ? cur.label : null;
  const installedRec = state.installedIndex.get(keyOf(categoryId, mod.name, styleLabel));
  const busy = state.installing.has(keyOf(categoryId, mod.name, styleLabel));
  const guide = mod.guideId && state.catalog?.guides?.[mod.guideId];

  $('#modalContent').innerHTML = `
    <div class="modal-media">${mediaHtml(prev, { autoplay: true })}</div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(mod.name)}</div>
        <button class="modal-close" id="modalCloseBtn" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style="color:var(--text-muted);font-size:12.5px">${esc(catName(categoryId))}${mod._group ? ' · ' + esc(mod._group) : ''}</div>
      ${styles ? `
        <div class="style-row">
          ${styles.map((s, i) => `
            <button class="style-btn ${i === styleIdx ? 'active' : ''}" data-style="${i}">
              ${s.color ? `<span class="swatch" style="background:${esc(s.color)}"></span>` : ''}${esc(s.label)}
            </button>`).join('')}
        </div>` : ''}
      <div class="modal-actions">
        ${isPack ? `<button class="btn btn-primary" id="installPackBtn">Установить пак (${(mod.mods || []).length})</button>` : ''}
        ${!isPack && target ? (installedRec
          ? `<button class="btn btn-danger" id="uninstallBtn">Удалить</button>`
          : `<button class="btn btn-primary" id="installBtn" ${busy ? 'disabled' : ''}>${busy ? 'Установка…' : 'Установить'}</button>`) : ''}
        ${!isPack && !target && mod.file ? `<button class="btn" id="openLinkBtn">Открыть ссылку</button>` : ''}
      </div>
      ${(mod.links || []).length || guide ? `
        <div class="modal-links">
          ${guide ? `<a id="modalGuideLink">Гайд: ${esc(guide.title)}</a>` : ''}
          ${(mod.links || []).map((l, i) => `<a data-link="${i}">${esc(l.type || 'ссылка')}</a>`).join('')}
        </div>` : ''}
      ${categoryId === 'fonts' ? `<div class="modal-note">Шрифт ставится в файлы игры (game\\dota\\panorama\\fonts) — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
      ${categoryId === 'cursors' ? `<div class="modal-note">Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
    </div>
  `;

  $('#modalCloseBtn').addEventListener('click', closeModal);

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
      const r = await window.api.mods.remove(installedRec.id);
      if (r.error) toast(r.error, 'error');
      else toast(`${mod.name} удалён`);
      await refreshInstalledIndex();
      drawModal();
    });
  }
  const packBtn = $('#installPackBtn');
  if (packBtn) {
    packBtn.addEventListener('click', () => installPack(mod));
  }
  const openLinkBtn = $('#openLinkBtn');
  if (openLinkBtn) {
    openLinkBtn.addEventListener('click', () => window.api.misc.openExternal(mod.file));
  }
  const guideLink = $('#modalGuideLink');
  if (guideLink) {
    guideLink.addEventListener('click', () => {
      closeModal();
      switchView('guides');
      setTimeout(() => {
        const el = document.querySelector(`[data-guide="${mod.guideId}"]`);
        if (el) { el.classList.add('open'); el.scrollIntoView({ behavior: 'smooth' }); }
      }, 60);
    });
  }
  (mod.links || []).forEach((l, i) => {
    const a = document.querySelector(`[data-link="${i}"]`);
    if (a) a.addEventListener('click', () => window.api.misc.openExternal(l.url));
  });
}

async function doInstall(categoryId, mod, styleLabel, fileRef, preview) {
  const k = keyOf(categoryId, mod.name, styleLabel);
  if (state.installing.has(k)) return;
  if (!state.settings?.dotaPathValid && !['tools'].includes(categoryId)) {
    toast('Сначала укажи путь к Dota 2 в настройках', 'warn');
    return;
  }
  state.installing.add(k);
  if (modalState) drawModal();
  const r = await window.api.mods.install({ categoryId, name: mod.name, styleLabel, fileRef, preview });
  state.installing.delete(k);
  if (r.error && !r.already) toast(`${mod.name}: ${r.error}`, 'error', 6000);
  else if (!r.error) toast(`${mod.name} установлен`);
  await refreshInstalledIndex();
  if (modalState) drawModal();
  return r;
}

async function installPack(pack) {
  const names = pack.mods || [];
  closeModal();
  let ok = 0, fail = 0, skip = 0;
  for (const name of names) {
    const hit = state.modIndex.get(name.toLowerCase());
    if (!hit) { skip++; continue; }
    const { categoryId, mod } = hit;
    const fileRef = mod.file || mod.styles?.[0]?.file;
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
      <span class="lib-stats">${installed.length} модов · ${enabledCount} включено</span>
      <button class="btn btn-sm" id="enableAllBtn">Включить всё</button>
      <button class="btn btn-sm" id="disableAllBtn">Отключить всё</button>
      <button class="btn btn-sm" id="openFolderBtn2">Папка модов</button>
    </div>
    <div class="lib-list" id="libList">
      ${installed.length ? '' : '<div class="empty-note">Пока ничего не установлено — загляни в Каталог</div>'}
    </div>
    ${external.length ? `
      <div class="section-h">Внешние файлы в папке модов</div>
      <div style="color:var(--text-muted);font-size:12.5px;margin-bottom:10px">Файлы, установленные не через менеджер</div>
      <div class="lib-list" id="extList"></div>` : ''}
  `;

  const libList = $('#libList');
  for (const rec of installed) {
    const row = document.createElement('div');
    row.className = `lib-row ${rec.enabled ? '' : 'disabled'}`;
    const prev = previewUrl(rec.categoryId, rec.preview);
    const fileNames = rec.files.filter((f) => f.root === 'lang').map((f) => f.relPath);
    row.innerHTML = `
      ${prev && !isVideo(prev) ? `<img class="lib-thumb" src="${esc(prev)}" loading="lazy" alt="">` : `<div class="lib-thumb"></div>`}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)}${rec.styleLabel ? ` <span style="color:var(--gold);font-size:12px">(${esc(rec.styleLabel)})</span>` : ''}</div>
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
  }

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
      if (!confirm(`Удалить «${rec.name}»?`)) return;
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
        if (!confirm(`Удалить файл ${b.dataset.extdel}?`)) return;
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
      <button class="btn btn-primary" id="savePresetBtn">Сохранить текущее состояние</button>
    </div>
    <div id="presetList">
      ${presets.length ? '' : '<div class="empty-note">Пресетов пока нет</div>'}
    </div>
  `;

  const list = $('#presetList');
  for (const p of presets) {
    const names = p.modIds.map((id) => byId.get(id)?.name).filter(Boolean);
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.innerHTML = `
      <div class="preset-head">
        <div class="preset-name">${esc(p.name)}</div>
        <span style="font-size:12px;color:var(--text-muted)">${names.length} модов</span>
        <button class="btn btn-sm btn-primary" data-apply="${p.id}">Применить</button>
        <button class="btn btn-sm btn-danger" data-pdel="${p.id}">Удалить</button>
      </div>
      <div class="preset-mods">${names.length ? esc(names.join(' · ')) : 'пусто (всё будет выключено)'}</div>
    `;
    list.appendChild(card);
  }

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
      await window.api.presets.delete(b.dataset.pdel);
      renderPresets();
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
        <div class="tool-card">
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-actions">
            ${dl ? (rec
              ? `<button class="btn btn-sm btn-primary" data-run="${esc(rec.files[0]?.relPath || '')}">Запустить</button>
                 <button class="btn btn-sm" data-open="${esc(rec.files[0]?.relPath || '')}">Папка</button>
                 <button class="btn btn-sm btn-danger" data-tdel="${rec.id}">Удалить</button>`
              : `<button class="btn btn-sm btn-primary" data-get="${i}">Скачать</button>`)
              : (t.file ? `<button class="btn btn-sm" data-url="${esc(t.file)}">Открыть сайт</button>` : '')}
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
  viewRoot.querySelectorAll('[data-guide]').forEach((b) => {
    b.addEventListener('click', () => {
      switchView('guides');
      setTimeout(() => {
        const el = document.querySelector(`[data-guide="${b.dataset.guide}"]`);
        if (el) { el.classList.add('open'); el.scrollIntoView({ behavior: 'smooth' }); }
      }, 60);
    });
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
          <svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
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
  // external links inside guide HTML
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

    <div class="settings-block">
      <h3>Папка модов и параметры запуска</h3>
      <div class="settings-row">
        <span class="settings-label">Языковая папка</span>
        <select class="input" id="langSelect">
          ${['123', 'minify', 'russian', 'test'].map((v) => `<option value="${v}" ${s.langSuffix === v ? 'selected' : ''}>dota_${v}</option>`).join('')}
        </select>
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
    </div>

    <div class="settings-block">
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

    <div class="settings-block">
      <h3>Каталог</h3>
      <div class="settings-row">
        <span class="settings-label">Обновлён</span>
        <span>${state.catalog?.fetchedAt ? new Date(state.catalog.fetchedAt).toLocaleString('ru') : '—'}</span>
        <button class="btn btn-sm" id="refreshCatBtn2">Обновить сейчас</button>
      </div>
      <div class="settings-row">
        <span class="settings-label">Источник</span>
        <a style="color:var(--gold);cursor:pointer;font-size:12.5px" id="srcLink">github.com/h6rd/Dota2PornFxWeb</a>
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
  $('#srcLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/h6rd/Dota2PornFxWeb'));
}

// ---------- helpers ----------

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  state.view = view;
  render();
}

async function refreshSidebarStatus() {
  const s = await window.api.settings.get();
  state.settings = s;
  const dotEl = $('#dotaStatusDot');
  const txtEl = $('#dotaStatusText');
  if (s.dotaPathValid) {
    dotEl.className = 'dot ok';
    txtEl.textContent = `Dota 2 · dota_${s.langSuffix}`;
  } else {
    dotEl.className = 'dot bad';
    txtEl.textContent = 'Dota 2 не найдена';
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
  await refreshSidebarStatus();
  await refreshInstalledIndex();
  await loadCatalog();
})();
