#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if [[ -x "$script_dir/node_modules/electron/dist/electron" ]]; then
  "$script_dir/node_modules/electron/dist/electron" .
else
  echo "Electron runtime not found. Run npm install first." >&2
  exit 1
fi
