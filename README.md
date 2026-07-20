# Dota 2 Mod Manager

Desktop launcher for Dota 2 cosmetic mods, powered by the open-source
[Dota2PornFx](https://github.com/h6rd/Dota2PornFxWeb) catalog (GPL-3.0).

## Features

- Browse the full mod catalog (40 categories: heroes, terrains, shaders, fonts, cursors, sounds, etc.) with live previews
- One-click install: downloads the mod, allocates `pakNN_dir.vpk` slots automatically (priority `!pakNN` for shaders/trees/river/etc.), extracts zips, handles terrain `maps/` folders
- Fonts and cursors are installed into game files directly with automatic backup of originals
- Library: see everything installed, enable/disable per mod, delete, detect external files
- Presets: save named sets of enabled mods and switch between them
- Tools: download and run VPK utilities (Background Changer, ItemsFix, Compiler, etc.)
- Guides from the repo rendered in-app (RU/EN)
- Auto-detects Steam/Dota 2 installation path

## Run

```
npm install
npm start
```

## How mods load

Mods are placed into `steamapps\common\dota 2 beta\game\dota_123\` and picked up by the
game with the `-language 123` launch option (set it in Steam → Dota 2 → Properties).
Fonts and cursors work without the launch option. The language folder name is configurable
in Settings.

## Dev notes

- `MM_SHOT=<path.png>` env var captures a screenshot after startup (optionally `MM_VIEW=<view>`)
- Downloads are cached in `%APPDATA%\dota2-mod-manager\downloads`
- Install manifest: `%APPDATA%\dota2-mod-manager\manifest.json`
