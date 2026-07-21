const fs = require('fs');
const path = require('path');
const os = require('os');

function getPlatformPath(platform = process.platform) {
  switch (platform) {
    case 'darwin': return 'Electron.app/Contents/MacOS/Electron';
    case 'linux': return 'electron';
    case 'win32': return 'electron.exe';
    default: throw new Error(`Unsupported platform: ${platform}`);
  }
}

function getElectronPackageRoot(rootDir) {
  return path.join(rootDir, 'node_modules', 'electron');
}

async function ensureElectronRuntime(opts = {}) {
  const rootDir = opts.rootDir || process.cwd();
  const packageRoot = getElectronPackageRoot(rootDir);
  const distDir = path.join(packageRoot, 'dist');
  const versionFile = path.join(distDir, 'version');
  const pathFile = path.join(packageRoot, 'path.txt');
  const binaryPath = path.join(distDir, getPlatformPath(opts.platform || process.platform));

  fs.mkdirSync(distDir, { recursive: true });

  const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const version = packageJson.version;
  const expectedVersion = version.replace(/^v/, '');

  if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8').trim() === expectedVersion && fs.existsSync(pathFile) && fs.readFileSync(pathFile, 'utf8').trim() === 'electron' && fs.existsSync(binaryPath)) {
    return { packageRoot, distDir, binaryPath };
  }

  const archiveName = `electron-v${version}-${(opts.platform || process.platform)}-${(opts.arch || process.arch)}.zip`;
  const archiveDest = path.join(os.tmpdir(), archiveName);
  const download = opts.downloadFile || (async (url, dest) => {
    const { execFileSync } = require('child_process');
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
    execFileSync(curl, ['-L', '--fail', '--retry', '3', '--retry-delay', '2', '--max-time', '600', url, '-o', dest], { stdio: 'inherit' });
  });
  const extract = opts.extractFile || (async (src, dest) => {
    const { execFileSync } = require('child_process');
    const unzip = process.platform === 'win32' ? 'powershell.exe' : 'unzip';
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Path '${src}' -DestinationPath '${dest}' -Force`], { stdio: 'inherit' });
    } else {
      execFileSync(unzip, ['-o', src, '-d', dest], { stdio: 'inherit' });
    }
  });

  const url = opts.url || `https://github.com/electron/electron/releases/download/v${version}/${archiveName}`;
  await download(url, archiveDest);
  await extract(archiveDest, distDir);

  fs.writeFileSync(pathFile, 'electron');
  fs.writeFileSync(versionFile, expectedVersion);
  fs.chmodSync(binaryPath, 0o755);
  return { packageRoot, distDir, binaryPath };
}

module.exports = { ensureElectronRuntime, getPlatformPath };
