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
  "bestGadgetIcon": "https://cdn.brawlify.com/gadgets/borderless/23000255.png",
  "bestStarPowerName": "Shell Shock",
  "bestStarPowerIcon": "https://cdn.brawlify.com/star-powers/borderless/23000076.png",
  "best2Gears": ["Damage", "Shield"],
  "best2GearsIcon": ["damage", "shield"],
  "brawlerIcon": "https://cdn.brawlify.com/brawlers/borders/16000000.png",
  "rarity": "Starting Brawler"
}
```

If a brawler has two good gadget choices depending on matchup or mode, you can add these optional fields:

```json
{
  "alternativeGadgetName": "Clay Pigeons",
  "alternativeGadgetIcon": "23000269"
}
```

When those fields are present, the brawler card will show both gadgets with a `Both viable` label.

## Recommended manual editing

Brawlify's own CDN README says the CDN is meant to be linked programmatically with asset IDs. Because of that, the best long-term workflow is to keep the same required fields, but store the Brawlify IDs in the `*Icon` fields whenever you can.

You can see that format here: [`src/data/brawlers.ids.example.json`](/Users/colin/Programming/best-builds/src/data/brawlers.ids.example.json)

If you want less typing, the site also accepts raw Brawlify asset IDs in any icon field instead of full URLs.

Examples:

- `"bestGadgetIcon": "23000255"`
- `"bestStarPowerIcon": "23000076"`
- `"best2GearsIcon": ["damage", "shield"]`
- `"brawlerIcon": "16000000"`

Gear icons are now local assets in [`src/assets/gears`](/Users/colin/Programming/best-builds/src/assets/gears), so `best2GearsIcon` should match the local filename without the extension. Astro optimizes those images at build time.
