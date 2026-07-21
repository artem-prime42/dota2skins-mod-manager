<div align="center">
  <img src="build/icon.png" alt="Dota 2 Mod Manager" width="110">

  <h1>Dota 2 Mod Manager</h1>

  <p><b>Desktop mod launcher for Dota 2.</b></p>

  <p>
    Preview:
  </p>

  <img src="https://i.postimg.cc/V619pVCP/dota2skins.png" alt="Preview" width="720">
</div>

---

## About

Mods shown in this launcher are sourced from the Dota2Skins website: https://dota2skins.vercel.app/

This repository contains the desktop launcher; download installers from Releases.

## Installation

1. Download **Dota 2 Mod Manager Setup** from the [latest release](https://github.com/artem-prime42/dota2skins-mod-manager/releases/latest)
2. Run it. The app installs, creates a desktop shortcut and starts
3. It finds your Dota 2 installation on its own (you can change the path in Settings)
4. Add the launch option shown in **Settings** to Steam (`Steam → Dota 2 → Properties → Launch Options`):

```
-language russian
```

Mods load from a custom language folder (`game/dota_russian`, `dota_123`), so the game needs a matching `-language` launch option. If you play in Russian, use `dota_russian` / `-language russian`: the game stays Russian and mods work. Fonts and cursors need no launch option at all.

## How it works

The app follows the same installation mechanics as the Dota2PornFx guides:

- VPK mods go into `steamapps/common/dota 2 beta/game/dota_<suffix>/` as `pakNN_dir.vpk`; the app assigns slots 10–99
- Priority categories (trees, river, shaders, hero fx, ranged attack, hero items, optimization) get `!pakNN` names and load first
- Terrains ship a `maps/` folder, placed next to the paks
- Fonts go to `game/dota/panorama/fonts`, cursors to `game/dota/resource/cursor`; the app backs up originals and restores them on removal
- Disabling a mod renames its file to `.off`; the game skips it, the file stays

Downloads live in `%APPDATA%/dota2-mod-manager/downloads`, the install manifest in `manifest.json` next to it.

<div align="center">
  <img src="docs/screenshots/pack.png" alt="Pack contents" width="70%">
</div>

## Установка (Russian)

1. Скачай **Dota 2 Mod Manager Setup** из [последнего релиза](https://github.com/artem-prime42/dota2skins-mod-manager/releases/latest)
2. Запусти. Приложение установится, создаст ярлык и откроется
3. Путь к Dota 2 находится автоматически
4. Добавь параметр запуска из **Настроек** в Steam (`Steam → Dota 2 → Свойства → Параметры запуска`):

```
-language russian
```

Играешь на русском — используй `dota_russian` / `-language russian`: игра останется русской, моды будут работать. Шрифты и курсоры работают без параметра запуска.
