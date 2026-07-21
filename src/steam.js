// Steam / Dota 2 installation discovery (Windows + Linux)
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
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
  const paths = [];
  const re = /"path"\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(vdfText)) !== null) {
    paths.push(m[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

async function findSteamRoot() {
  const candidates = [];
  if (process.platform === 'win32') {
    candidates.push(
      await regQuery('HKCU', 'SOFTWARE\\Valve\\Steam', 'SteamPath'),
      await regQuery('HKLM', 'SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
      await regQuery('HKLM', 'SOFTWARE\\Valve\\Steam', 'InstallPath'),
    );
  }

  const home = os.homedir();
  if (process.platform === 'linux') {
    candidates.push(
      path.join(home, '.steam', 'steam'),
      path.join(home, '.steam', 'root', 'steam'),
      path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'steam'),
      '/mnt/steam',
    );
  }

  for (let c of candidates) {
    if (!c) continue;
    c = c.replace(/\//g, path.sep);
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findLinuxSteamLibraryCandidates(steamRoot) {
  const home = os.homedir();
  const libs = [];
  const vdfCandidates = [
    path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'),
    path.join(steamRoot, 'steamapps', 'libraryfolders.vdf.bak'),
    path.join(home, '.steam', 'steam', 'steamapps', 'libraryfolders.vdf'),
    path.join(home, '.steam', 'root', 'steam', 'steamapps', 'libraryfolders.vdf'),
  ];
  for (const vdf of vdfCandidates) {
    if (!fs.existsSync(vdf)) continue;
    try {
      const parsed = parseLibraryFolders(fs.readFileSync(vdf, 'utf-8'));
      libs.push(...parsed);
    } catch { /* ignore */ }
  }
  return libs;
}

async function findDotaGamePath() {
  const steamRoot = await findSteamRoot();
  const libs = [];
  if (steamRoot) {
    libs.push(steamRoot);
    libs.push(...findLinuxSteamLibraryCandidates(steamRoot));
    const vdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdf)) {
      try {
        libs.push(...parseLibraryFolders(fs.readFileSync(vdf, 'utf-8')));
      } catch { /* ignore parse errors, fall back to scan */ }
    }
  }

  if (process.platform === 'win32') {
    for (const drive of 'CDEFGH') {
      libs.push(
        `${drive}:\\Program Files (x86)\\Steam`,
        `${drive}:\\Program Files\\Steam`,
        `${drive}:\\Steam`,
        `${drive}:\\Games\\Steam`,
        `${drive}:\\SteamLibrary`
      );
    }
  } else {
    libs.push(
      path.join(os.homedir(), '.steam', 'steam', 'steamapps', 'common', 'dota 2 beta', 'game'),
      path.join(os.homedir(), '.steam', 'root', 'steam', 'steamapps', 'common', 'dota 2 beta', 'game'),
      '/home/steam/steam/steamapps/common/dota 2 beta/game',
      '/mnt/games/steam/steamapps/common/dota 2 beta/game',
      '/usr/games/steam/steamapps/common/dota 2 beta/game',
    );
  }

  const seen = new Set();
  for (const lib of libs) {
    if (!lib || seen.has(lib.toLowerCase())) continue;
    seen.add(lib.toLowerCase());
    if (fs.existsSync(path.join(lib, 'dota'))) return lib;
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
