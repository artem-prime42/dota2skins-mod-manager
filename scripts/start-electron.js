#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const { ensureElectronRuntime } = require('../src/electron-runtime');

(async () => {
  try {
    const result = await ensureElectronRuntime({ rootDir: process.cwd() });
    const child = spawn(result.binaryPath, ['.'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '' },
    });
    child.on('exit', (code) => process.exit(code ?? 0));
    child.on('error', (err) => {
      console.error(err);
      process.exit(1);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
