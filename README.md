# Best Builds

Really fast website for viewing the best builds of Brawlers.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
```

## JSON format

Each brawler entry must contain these fields:

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

If a brawler has a clear default plus niche alternatives, you can add these optional fields:

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

When those fields are present, the site keeps the main gadget, star power, and 2-gear pair as the safe default, then shows the extra options as niche backups or swaps.

## Recommended manual editing

Brawlify's own CDN README says the CDN is meant to be linked programmatically with asset IDs. Because of that, the best long-term workflow is to keep the same required fields, but store the Brawlify IDs in the `*Icon` fields whenever you can.

You can see that format here: [`src/data/brawlers.ids.example.json`](/Users/colin/Programming/best-builds/src/data/brawlers.ids.example.json)

If you want less typing, the site accepts raw Brawlify asset IDs in any icon field instead of full URLs.

Examples:

- `"bestGadgetIcon": "23000255"`
- `"bestStarPowerIcon": "23000076"`
- `"best2GearsIcon": ["damage", "shield"]`
- `"brawlerIcon": "16000000"`

Gear icons are now local assets in [`src/assets/gears`](/Users/colin/Programming/best-builds/src/assets/gears), so `best2GearsIcon` should match the local filename without the extension. Astro optimizes those images at build time.

## CDN base URL

The JSON only needs icon IDs. The app builds the full icon URL at runtime using the CDN base URL configured in:

- [`src/lib/brawlers.ts`](/Users/colin/Programming/best-builds/src/lib/brawlers.ts)
- `PUBLIC_BRAWLIFY_CDN_BASE_URL` in `.env`

You can copy [`.env.example`](/Users/colin/Programming/best-builds/.env.example) to `.env` and change that one value if the CDN host ever changes.

## Bulk conversion

If you import data that still contains full gadget/star power URLs, run:

```bash
pnpm run normalize:icon-ids
```

That script rewrites `bestGadgetIcon`, `alternativeGadgetIcon`, `bestStarPowerIcon`, and `alternativeStarPower.icon` in [`src/data/brawlers.json`](/Users/colin/Programming/best-builds/src/data/brawlers.json) to just the asset ID. It also migrates legacy `alternativeStarPowers` arrays to a single `alternativeStarPower` object.
