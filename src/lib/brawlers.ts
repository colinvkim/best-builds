import type { ImageMetadata } from "astro";

export const RARITY_ORDER = [
  "Starting Brawler",
  "Rare",
  "Super Rare",
  "Epic",
  "Mythic",
  "Legendary",
  "Ultra Legendary",
] as const;

export type Rarity = (typeof RARITY_ORDER)[number];

export type IconInput = string;

export type AlternativeChoiceInput = {
  name: string;
  icon: IconInput;
};

export type RawBrawler = {
  brawlerName: string;
  bestGadgetName: string;
  bestGadgetIcon: IconInput;
  alternativeGadgetName?: string;
  alternativeGadgetIcon?: IconInput;
  bestStarPowerName: string;
  bestStarPowerIcon: IconInput;
  alternativeStarPower?: AlternativeChoiceInput;
  best2Gears: [string, string];
  best2GearsIcon: [IconInput, IconInput];
  alternativeGears?: AlternativeChoiceInput[];
  brawlerIcon: IconInput;
  rarity: Rarity;
};

export type GadgetChoice = {
  name: string;
  iconUrl: string;
};

export type GearChoice = {
  key: string;
  name: string;
  image: ImageMetadata;
};

export type Brawler = RawBrawler & {
  bestGadgetIconUrl: string;
  alternativeGadgetIconUrl?: string;
  gadgetChoices: GadgetChoice[];
  bestStarPowerIconUrl: string;
  alternativeStarPowerChoice?: GadgetChoice;
  starPowerChoices: GadgetChoice[];
  best2GearsImage: [ImageMetadata, ImageMetadata];
  bestGearChoices: [GearChoice, GearChoice];
  alternativeGearChoices: GearChoice[];
  allGearChoices: GearChoice[];
  brawlerIconUrl: string;
  rarityRank: number;
  searchIndex: string;
};

type IconKind = "brawler" | "gadget" | "star-power";

const ICON_CDN_BASE_URL =
  "https://raw.githubusercontent.com/colinvkim/CDN/refs/heads/master".replace(
    /\/+$/,
    "",
  );

const CDN_PATHS: Record<IconKind, string> = {
  brawler: "/brawlers/borders/{id}.png",
  gadget: "/gadgets/regular/{id}.png",
  "star-power": "/star-powers/regular/{id}.png",
};

const gearImageModules = import.meta.glob(
  "../assets/gears/*.{png,webp,avif,jpg,jpeg}",
  {
    eager: true,
    import: "default",
  },
) as Record<string, ImageMetadata>;

const gearImages = new Map<string, ImageMetadata>(
  Object.entries(gearImageModules).map(([path, image]) => {
    const assetKey = path
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
      .toLowerCase();

    return [assetKey ?? path, image];
  }),
);

const GEAR_ORDER = [
  "damage",
  "shield",
  "speed",
  "health",
  "reload",
  "vision",
  "gadget",
  "super",
  "pet",
  "amber",
  "crow",
  "eve",
  "gene",
  "leon",
  "mortis",
  "pam",
  "sandy",
  "spike",
  "tick",
] as const;

const GEAR_LABELS: Record<string, string> = {
  damage: "Damage",
  shield: "Shield",
  speed: "Speed",
  health: "Health",
  reload: "Reload",
  vision: "Vision",
  gadget: "Gadget Charge",
  super: "Super Charge",
  pet: "Pet Power",
  amber: "Amber",
  crow: "Crow",
  eve: "Eve",
  gene: "Gene",
  leon: "Leon",
  mortis: "Mortis",
  pam: "Pam",
  sandy: "Sandy",
  spike: "Spike",
  tick: "Tick",
};

export type GearOption = {
  key: string;
  name: string;
  image: ImageMetadata;
};

export const GEAR_OPTIONS: GearOption[] = Array.from(gearImages.entries())
  .sort(([leftKey], [rightKey]) => {
    const leftIndex = GEAR_ORDER.indexOf(
      leftKey as (typeof GEAR_ORDER)[number],
    );
    const rightIndex = GEAR_ORDER.indexOf(
      rightKey as (typeof GEAR_ORDER)[number],
    );

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }

      if (rightIndex === -1) {
        return -1;
      }

      return leftIndex - rightIndex;
    }

    return leftKey.localeCompare(rightKey);
  })
  .map(([key, image]) => ({
    key,
    name: GEAR_LABELS[key] ?? key,
    image,
  }));

export const RARITY_STYLES: Record<
  Rarity,
  { color: string; textColor: string }
> = {
  "Starting Brawler": { color: "#f0f9ff", textColor: "#0369a1" },
  Rare: { color: "#f0fdf4", textColor: "#15803d" },
  "Super Rare": { color: "#eff6ff", textColor: "#1d4ed8" },
  Epic: { color: "#f5f3ff", textColor: "#6d28d9" },
  Mythic: { color: "#fff1f2", textColor: "#be123c" },
  Legendary: { color: "#fffbeb", textColor: "#b45309" },
  "Ultra Legendary": { color: "#fff7ed", textColor: "#c2410c" },
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isRarity = (value: unknown): value is Rarity =>
  typeof value === "string" && RARITY_ORDER.includes(value as Rarity);

const isAlternativeChoiceInput = (
  value: unknown,
): value is AlternativeChoiceInput =>
  Boolean(
    value &&
    typeof value === "object" &&
    isNonEmptyString((value as { name?: unknown }).name) &&
    isNonEmptyString((value as { icon?: unknown }).icon),
  );

const normalizeIcon = (value: string, kind: IconKind): string => {
  const trimmed = value.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${ICON_CDN_BASE_URL}${CDN_PATHS[kind].replace("{id}", trimmed)}`;
};

const toAssetKey = (value: string): string =>
  value
    .trim()
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, "-") ?? "";

const resolveGearImage = (
  iconValue: string,
  gearName: string,
): ImageMetadata => {
  const candidates = [toAssetKey(iconValue), toAssetKey(gearName)];

  for (const candidate of candidates) {
    const image = gearImages.get(candidate);

    if (image) {
      return image;
    }
  }

  throw new Error(
    `Missing local gear asset for "${gearName}". Expected a file in src/assets/gears that matches "${iconValue}" or "${gearName}".`,
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
      throw new Error(
        `Brawler entry "${candidate.brawlerName ?? index}" is missing a required field.`,
      );
    }

    const hasAlternativeGadgetFields =
      candidate.alternativeGadgetName !== undefined ||
      candidate.alternativeGadgetIcon !== undefined;

    if (
      hasAlternativeGadgetFields &&
      (!isNonEmptyString(candidate.alternativeGadgetName) ||
        !isNonEmptyString(candidate.alternativeGadgetIcon))
    ) {
      throw new Error(
        `Brawler entry "${candidate.brawlerName}" must include both alternative gadget fields when one is present.`,
      );
    }

    if (
      candidate.alternativeStarPower !== undefined &&
      !isAlternativeChoiceInput(candidate.alternativeStarPower)
    ) {
      throw new Error(
        `Brawler entry "${candidate.brawlerName}" must provide alternative star power as a { name, icon } object.`,
      );
    }

    if (
      !Array.isArray(candidate.best2Gears) ||
      candidate.best2Gears.length !== 2 ||
      !candidate.best2Gears.every(isNonEmptyString)
    ) {
      throw new Error(
        `Brawler entry "${candidate.brawlerName}" must contain exactly 2 gear names.`,
      );
    }

    if (
      !Array.isArray(candidate.best2GearsIcon) ||
      candidate.best2GearsIcon.length !== 2 ||
      !candidate.best2GearsIcon.every(isNonEmptyString)
    ) {
      throw new Error(
        `Brawler entry "${candidate.brawlerName}" must contain exactly 2 gear icons.`,
      );
    }

    if (
      candidate.alternativeGears !== undefined &&
      (!Array.isArray(candidate.alternativeGears) ||
        !candidate.alternativeGears.every(isAlternativeChoiceInput))
    ) {
      throw new Error(
        `Brawler entry "${candidate.brawlerName}" must provide alternative gears as { name, icon } objects.`,
      );
    }

    const brawlerName = candidate.brawlerName;
    const bestGadgetName = candidate.bestGadgetName;
    const bestGadgetIcon = candidate.bestGadgetIcon;
    const alternativeGadgetName = candidate.alternativeGadgetName?.trim();
    const alternativeGadgetIcon = candidate.alternativeGadgetIcon?.trim();
    const bestStarPowerName = candidate.bestStarPowerName;
    const bestStarPowerIcon = candidate.bestStarPowerIcon;
    const alternativeStarPower = candidate.alternativeStarPower
      ? {
          name: candidate.alternativeStarPower.name.trim(),
          icon: candidate.alternativeStarPower.icon.trim(),
        }
      : undefined;
    const brawlerIcon = candidate.brawlerIcon;
    const rarity = candidate.rarity;
    const best2Gears: [string, string] = [
      candidate.best2Gears[0],
      candidate.best2Gears[1],
    ];
    const best2GearsIcon: [string, string] = [
      candidate.best2GearsIcon[0],
      candidate.best2GearsIcon[1],
    ];
    const alternativeGears = (candidate.alternativeGears ?? []).map(
      (choice) => ({
        name: choice.name.trim(),
        icon: choice.icon.trim(),
      }),
    );
    const rarityRank = RARITY_ORDER.indexOf(rarity);
    const bestGadgetIconUrl = normalizeIcon(bestGadgetIcon, "gadget");
    const alternativeGadgetIconUrl = alternativeGadgetIcon
      ? normalizeIcon(alternativeGadgetIcon, "gadget")
      : undefined;
    const gadgetChoices: GadgetChoice[] = [
      { name: bestGadgetName, iconUrl: bestGadgetIconUrl },
    ];
    const bestStarPowerIconUrl = normalizeIcon(bestStarPowerIcon, "star-power");
    const alternativeStarPowerChoice = alternativeStarPower
      ? {
          name: alternativeStarPower.name,
          iconUrl: normalizeIcon(alternativeStarPower.icon, "star-power"),
        }
      : undefined;
    const starPowerChoices: GadgetChoice[] = [
      { name: bestStarPowerName, iconUrl: bestStarPowerIconUrl },
      ...(alternativeStarPowerChoice ? [alternativeStarPowerChoice] : []),
    ];
    const bestGearChoices: [GearChoice, GearChoice] = [
      {
        key: toAssetKey(best2GearsIcon[0]),
        name: best2Gears[0],
        image: resolveGearImage(best2GearsIcon[0], best2Gears[0]),
      },
      {
        key: toAssetKey(best2GearsIcon[1]),
        name: best2Gears[1],
        image: resolveGearImage(best2GearsIcon[1], best2Gears[1]),
      },
    ];
    const alternativeGearChoices: GearChoice[] = alternativeGears.map(
      (choice) => ({
        key: toAssetKey(choice.icon),
        name: choice.name,
        image: resolveGearImage(choice.icon, choice.name),
      }),
    );
    const allGearChoices: GearChoice[] = [
      ...bestGearChoices,
      ...alternativeGearChoices,
    ];

    if (alternativeGadgetName && alternativeGadgetIconUrl) {
      gadgetChoices.push({
        name: alternativeGadgetName,
        iconUrl: alternativeGadgetIconUrl,
      });
    }

    return {
      brawlerName,
      bestGadgetName,
      bestGadgetIcon,
      alternativeGadgetName,
      alternativeGadgetIcon,
      bestStarPowerName,
      bestStarPowerIcon,
      alternativeStarPower,
      best2Gears,
      best2GearsIcon,
      alternativeGears,
      brawlerIcon,
      rarity,
      bestGadgetIconUrl,
      alternativeGadgetIconUrl,
      gadgetChoices,
      bestStarPowerIconUrl,
      alternativeStarPowerChoice,
      starPowerChoices,
      best2GearsImage: [bestGearChoices[0].image, bestGearChoices[1].image],
      bestGearChoices,
      alternativeGearChoices,
      allGearChoices,
      brawlerIconUrl: normalizeIcon(brawlerIcon, "brawler"),
      rarityRank,
      searchIndex: [brawlerName, rarity].join(" ").toLowerCase(),
    };
  });
};
