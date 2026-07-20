// Catalog: fetch + cache mods.json / constants.json / guides.json from the Dota2PornFx repo
const fs = require('fs');
const path = require('path');

const RAW_BASE = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';
const DATA_FILES = ['mods.json', 'constants.json', 'guides.json'];

class Catalog {
  constructor(userDataDir) {
    this.cacheDir = path.join(userDataDir, 'catalog-cache');
    fs.mkdirSync(this.cacheDir, { recursive: true });
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
    return DATA_FILES.every((f) => fs.existsSync(this.cachePath(f)));
  }

  async refresh() {
    for (const name of DATA_FILES) {
      const res = await fetch(`${RAW_BASE}/assets/data/${name}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${name}`);
      const text = await res.text();
      JSON.parse(text); // validate before persisting
      fs.writeFileSync(this.cachePath(name), text);
    }
    fs.writeFileSync(this.cachePath('meta.json'), JSON.stringify({ fetchedAt: Date.now() }));
  }

  async load({ forceRefresh = false } = {}) {
    if (forceRefresh || !this.hasCache()) {
      await this.refresh();
    }
    const out = { fetchedAt: this.cacheInfo().fetchedAt };
    for (const name of DATA_FILES) {
      out[name.replace('.json', '')] = JSON.parse(fs.readFileSync(this.cachePath(name), 'utf-8'));
    }
    return out;
  }
}

module.exports = { Catalog, RAW_BASE };
