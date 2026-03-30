import type { ImageMetadata } from "astro";

export const RARITY_ORDER = [
  "Starting Brawler",
  "Rare",
  "Super Rare",
  "Epic",
  "Mythic",
  "Legendary",
  "Ultra Legendary"
] as const;

export type Rarity = (typeof RARITY_ORDER)[number];

export type IconInput = string;

export type RawBrawler = {
  brawlerName: string;
  bestGadgetName: string;
  bestGadgetIcon: IconInput;
  bestStarPowerName: string;
  bestStarPowerIcon: IconInput;
  best2Gears: [string, string];
  best2GearsIcon: [IconInput, IconInput];
  brawlerIcon: IconInput;
  rarity: Rarity;
};

export type Brawler = RawBrawler & {
  bestGadgetIconUrl: string;
  bestStarPowerIconUrl: string;
  best2GearsImage: [ImageMetadata, ImageMetadata];
  brawlerIconUrl: string;
  rarityRank: number;
  searchIndex: string;
};

type IconKind = "brawler" | "gadget" | "star-power";

const CDN_PATTERNS: Record<IconKind, string> = {
  brawler: "https://cdn.brawlify.com/brawlers/borders/{id}.png",
  gadget: "https://cdn.brawlify.com/gadgets/borderless/{id}.png",
  "star-power": "https://cdn.brawlify.com/star-powers/borderless/{id}.png"
};

const gearImageModules = import.meta.glob("../assets/gears/*.{png,webp,avif,jpg,jpeg}", {
  eager: true,
  import: "default"
}) as Record<string, ImageMetadata>;

const gearImages = new Map<string, ImageMetadata>(
  Object.entries(gearImageModules).map(([path, image]) => {
    const assetKey = path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
      .toLowerCase();

    return [assetKey ?? path, image];
  })
);

export const RARITY_STYLES: Record<Rarity, { color: string; textColor: string }> = {
  "Starting Brawler": { color: "#b9eaff", textColor: "#0c3950" },
  Rare: { color: "#68fd58", textColor: "#123d0a" },
  "Super Rare": { color: "#5ab3ff", textColor: "#0b315f" },
  Epic: { color: "#d850ff", textColor: "#410e4d" },
  Mythic: { color: "#fe5e72", textColor: "#551019" },
  Legendary: { color: "#fff11e", textColor: "#433d00" },
  "Ultra Legendary": { color: "#f88f25", textColor: "#4f2300" }
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isRarity = (value: unknown): value is Rarity =>
  typeof value === "string" && RARITY_ORDER.includes(value as Rarity);

const normalizeIcon = (value: string, kind: IconKind): string => {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return CDN_PATTERNS[kind].replace("{id}", trimmed);
};

const toAssetKey = (value: string): string =>
  value
    .trim()
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, "-") ?? "";

const resolveGearImage = (iconValue: string, gearName: string): ImageMetadata => {
  const candidates = [toAssetKey(iconValue), toAssetKey(gearName)];

  for (const candidate of candidates) {
    const image = gearImages.get(candidate);

    if (image) {
      return image;
    }
  }

  throw new Error(
    `Missing local gear asset for "${gearName}". Expected a file in src/assets/gears that matches "${iconValue}" or "${gearName}".`
  );
};

export const normalizeBrawlers = (data: unknown): Brawler[] => {
  if (!Array.isArray(data)) {
    throw new Error("Brawler data must be an array.");
  }

  return data.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Brawler entry at index ${index} must be an object.`);
    }

    const candidate = entry as Partial<RawBrawler>;

    if (
      !isNonEmptyString(candidate.brawlerName) ||
      !isNonEmptyString(candidate.bestGadgetName) ||
      !isNonEmptyString(candidate.bestGadgetIcon) ||
      !isNonEmptyString(candidate.bestStarPowerName) ||
      !isNonEmptyString(candidate.bestStarPowerIcon) ||
      !isNonEmptyString(candidate.brawlerIcon) ||
      !isRarity(candidate.rarity)
    ) {
      throw new Error(`Brawler entry "${candidate.brawlerName ?? index}" is missing a required field.`);
    }

    if (
      !Array.isArray(candidate.best2Gears) ||
      candidate.best2Gears.length !== 2 ||
      !candidate.best2Gears.every(isNonEmptyString)
    ) {
      throw new Error(`Brawler entry "${candidate.brawlerName}" must contain exactly 2 gear names.`);
    }

    if (
      !Array.isArray(candidate.best2GearsIcon) ||
      candidate.best2GearsIcon.length !== 2 ||
      !candidate.best2GearsIcon.every(isNonEmptyString)
    ) {
      throw new Error(`Brawler entry "${candidate.brawlerName}" must contain exactly 2 gear icons.`);
    }

    const brawlerName = candidate.brawlerName;
    const bestGadgetName = candidate.bestGadgetName;
    const bestGadgetIcon = candidate.bestGadgetIcon;
    const bestStarPowerName = candidate.bestStarPowerName;
    const bestStarPowerIcon = candidate.bestStarPowerIcon;
    const brawlerIcon = candidate.brawlerIcon;
    const rarity = candidate.rarity;
    const best2Gears: [string, string] = [candidate.best2Gears[0], candidate.best2Gears[1]];
    const best2GearsIcon: [string, string] = [
      candidate.best2GearsIcon[0],
      candidate.best2GearsIcon[1]
    ];
    const rarityRank = RARITY_ORDER.indexOf(rarity);

    return {
      brawlerName,
      bestGadgetName,
      bestGadgetIcon,
      bestStarPowerName,
      bestStarPowerIcon,
      best2Gears,
      best2GearsIcon,
      brawlerIcon,
      rarity,
      bestGadgetIconUrl: normalizeIcon(bestGadgetIcon, "gadget"),
      bestStarPowerIconUrl: normalizeIcon(bestStarPowerIcon, "star-power"),
      best2GearsImage: [
        resolveGearImage(best2GearsIcon[0], best2Gears[0]),
        resolveGearImage(best2GearsIcon[1], best2Gears[1])
      ],
      brawlerIconUrl: normalizeIcon(brawlerIcon, "brawler"),
      rarityRank,
      searchIndex: [brawlerName, rarity].join(" ").toLowerCase()
    };
  });
};
