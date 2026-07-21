#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

shopt -s nullglob
appimage_candidates=(
  "$script_dir/dist"/*.AppImage
  "$script_dir"/*.AppImage
)
shopt -u nullglob

appimage=""
for candidate in "${appimage_candidates[@]}"; do
  if [[ -f "$candidate" ]]; then
    appimage="$candidate"
    break
  fi
done

if [[ -z "$appimage" ]]; then
  echo "AppImage not found. Build it first with:"
  echo "  npx electron-builder --linux --win --publish never"
  exit 1
fi

chmod +x "$appimage"

extract_dir="$script_dir/squashfs-root"
if [[ -x "$extract_dir/AppRun" ]]; then
  exec "$extract_dir/AppRun" "$@"
fi

if "$appimage" --appimage-extract >/tmp/dota2-mod-manager-appimage.log 2>&1; then
  if [[ -x "$extract_dir/AppRun" ]]; then
    exec "$extract_dir/AppRun" "$@"
  fi
fi

if [[ -f "$appimage" ]]; then
  echo "Unable to start AppImage directly. Try installing FUSE:"
  echo "  sudo pacman -S fuse2" 2>/dev/null || true
  echo "  sudo apt install -y libfuse2" 2>/dev/null || true
fi

exec "$appimage" "$@"
