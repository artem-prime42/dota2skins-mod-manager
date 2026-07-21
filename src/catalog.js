// Catalog: fetch + cache catalog payload from the Dota2Skins site or a local file.
const fs = require('fs');
const path = require('path');
const { loadSiteCatalog } = require('./catalog-site-adapter');

const DEFAULT_BASE = 'https://raw.githubusercontent.com/artem-prime42/dota2-mod-manager-catalog/main';
const DEFAULT_CATALOG_URL = `${DEFAULT_BASE}/catalog.json`;
const DEFAULT_DATA_FILE = 'catalog.json';
const RAW_BASE = DEFAULT_BASE;

class Catalog {
  constructor(userDataDir, opts = {}) {
    this.cacheDir = path.join(userDataDir, 'catalog-cache');
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const defaultSource = process.env.DOTA2SKINS_CATALOG_URL
      ? { type: 'remote', url: process.env.DOTA2SKINS_CATALOG_URL }
      : {
          type: 'site',
          repoRoot: process.env.DOTA2SKINS_SITE_REPO || 'https://github.com/artem-prime42/dota2-mod-manager-catalog',
          dataUrl: process.env.DOTA2SKINS_SITE_CATALOG_URL || DEFAULT_CATALOG_URL,
        };
    this.source = opts.source || defaultSource;
  }

  cachePath(name) {
    return path.join(this.cacheDir, name);
  }

  cacheInfo() {
    const metaFile = this.cachePath('meta.json');
    try {
      return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    } catch {
      return { fetchedAt: null };
    }
  }

  hasCache() {
    return fs.existsSync(this.cachePath(DEFAULT_DATA_FILE));
  }

  async refresh() {
    let parsed;
    let text;
    if (this.source.type === 'file') {
      text = fs.readFileSync(this.source.filePath, 'utf-8');
      parsed = JSON.parse(text);
    } else if (this.source.type === 'site') {
      const dataUrl = this.source.dataUrl || this.source.fileUrl;
      if (dataUrl) {
        const res = await fetch(dataUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} while fetching catalog`);
        text = await res.text();
        parsed = JSON.parse(text);
      } else {
        parsed = await loadSiteCatalog(this.source);
        text = JSON.stringify(parsed);
      }
    } else {
      try {
        const res = await fetch(this.source.url || DEFAULT_CATALOG_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status} while fetching catalog`);
        text = await res.text();
        parsed = JSON.parse(text);
      } catch (err) {
        if (this.source.fallbackSiteRoot) {
          parsed = loadSiteCatalog(this.source.fallbackSiteRoot);
          text = JSON.stringify(parsed);
        } else {
          throw err;
        }
      }
    }

    fs.writeFileSync(this.cachePath(DEFAULT_DATA_FILE), text);
    fs.writeFileSync(this.cachePath('meta.json'), JSON.stringify({ fetchedAt: Date.now() }));
    return parsed;
  }

  async load({ forceRefresh = false } = {}) {
    const shouldRefresh = forceRefresh || !this.hasCache() || this.source.type === 'site';
    if (shouldRefresh) {
      await this.refresh();
    }
    const text = fs.readFileSync(this.cachePath(DEFAULT_DATA_FILE), 'utf-8');
    const parsed = JSON.parse(text);
    return {
      ...parsed,
      fetchedAt: this.cacheInfo().fetchedAt,
    };
  }
}

module.exports = { Catalog, DEFAULT_BASE, DEFAULT_CATALOG_URL, RAW_BASE };
