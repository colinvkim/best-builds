# Best Builds

A fast, minimal Astro site that shows the best gadget, star power, and gear setup for every Brawl Stars Brawler.

![Astro](https://img.shields.io/badge/Astro-FF5D01?logo=astro&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Why?

Brawl Stars has over 100 Brawlers, each with multiple gadgets, star powers, and gear options. Figuring out the best setup means carefully watching YouTube videos or scrolling through Discord servers. This website cuts through the noise with data sourced directly from pros.

The data lives in a single JSON file so anyone can edit it without touching code.

## Features

### Brawler Loadouts

- **Default setup** — best gadget, best star power, and top 2 gears for every brawler
- **Niche alternatives** — optional backup gadget, star power, and gear swaps for specific matchups
- **Asset ID system** — store Brawlify CDN IDs instead of full URLs; the app builds icon URLs at runtime

### Data Entry

- Single JSON file at `src/data/brawlers.json`
- Add or edit a brawler in under a minute
- Run `pnpm run normalize:icon-ids` to convert full URLs to asset IDs after bulk imports

### Performance

- **Static site** — built once, served as plain HTML/CSS/JS
- **Zero JavaScript framework overhead** — Astro strips unused JS by default
- **Optimized icons** — gear icons are local assets, optimized at build time

## Requirements

- **Node.js 20+**
- **pnpm**

## Installation

```bash
git clone https://github.com/colinvkim/best-builds.git
cd best-builds
pnpm install
```

## Development

Start the dev server:

```bash
pnpm dev
```

Build for production:

```bash
pnpm build
```

## JSON Format

Each brawler entry requires these fields:

```json
{
  "brawlerName": "Shelly",
  "bestGadgetName": "Fast Forward",
  "bestGadgetIcon": "23000255",
  "bestStarPowerName": "Shell Shock",
  "bestStarPowerIcon": "23000076",
  "best2Gears": ["Damage", "Shield"],
  "best2GearsIcon": ["damage", "shield"],
  "brawlerIcon": "16000000",
  "rarity": "Starting Brawler"
}
```

Optional fields for niche alternatives:

```json
{
  "alternativeGadgetName": "Clay Pigeons",
  "alternativeGadgetIcon": "23000269",
  "alternativeStarPower": { "name": "Band-Aid", "icon": "23000077" },
  "alternativeGears": [
    { "name": "Speed", "icon": "speed" },
    { "name": "Vision", "icon": "vision" }
  ]
}
```

Icon fields accept Brawlify asset IDs (e.g. `"23000255"`) — the app resolves them to full CDN URLs at runtime. Gear icons are local files in `src/assets/gears/`, so `best2GearsIcon` should match the filename without extension.

## Scripts

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `pnpm dev`                    | Start Astro dev server                              |
| `pnpm build`                  | Build static site for production                    |
| `pnpm run normalize:icon-ids` | Convert full CDN URLs in brawlers.json to asset IDs |

## Contributing

1. Fork the repo and create a feature branch
2. Add or update brawler entries in `src/data/brawlers.json`
3. Run `pnpm run normalize:icon-ids` if you pasted full URLs
4. Open a pull request with the changes

If a loadout feels wrong, link a source (YouTube, tournament VOD, etc.) so it can be verified.

## License

MIT. See [LICENSE](LICENSE) for details.
