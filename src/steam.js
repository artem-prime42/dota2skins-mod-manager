// Steam / Dota 2 installation discovery (Windows)
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function regQuery(hive, key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', `${hive}\\${key}`, '/v', value], (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const m = stdout.match(/REG_SZ\s+(.+)/);
      resolve(m ? m[1].trim() : null);
    });
  });
}

function parseLibraryFolders(vdfText) {
  // libraryfolders.vdf: "path" "C:\\..." entries
  const paths = [];
  const re = /"path"\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(vdfText)) !== null) {
    paths.push(m[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

async function findSteamRoot() {
  const candidates = [
    await regQuery('HKCU', 'SOFTWARE\\Valve\\Steam', 'SteamPath'),
    await regQuery('HKLM', 'SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    await regQuery('HKLM', 'SOFTWARE\\Valve\\Steam', 'InstallPath'),
  ];
  for (let c of candidates) {
    if (!c) continue;
    c = c.replace(/\//g, '\\');
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function findDotaGamePath() {
  const steamRoot = await findSteamRoot();
  const libs = [];
  if (steamRoot) {
    libs.push(steamRoot);
    const vdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdf)) {
      try {
        libs.push(...parseLibraryFolders(fs.readFileSync(vdf, 'utf-8')));
      } catch { /* ignore parse errors, fall back to scan */ }
    }
  }
  // common fallback locations on all drives
  for (const drive of 'CDEFGH') {
    libs.push(
      `${drive}:\\Program Files (x86)\\Steam`,
      `${drive}:\\Program Files\\Steam`,
      `${drive}:\\Steam`,
      `${drive}:\\Games\\Steam`,
      `${drive}:\\SteamLibrary`
    );
  }
  const seen = new Set();
  for (const lib of libs) {
    if (!lib || seen.has(lib.toLowerCase())) continue;
    seen.add(lib.toLowerCase());
    const game = path.join(lib, 'steamapps', 'common', 'dota 2 beta', 'game');
    if (fs.existsSync(path.join(game, 'dota'))) return game;
  }
  return null;
}

function validateGamePath(p) {
  if (!p) return false;
  try {
    return fs.existsSync(path.join(p, 'dota'));
  } catch {
    return false;
  }
}

module.exports = { findDotaGamePath, validateGamePath };
