import { readFile, writeFile } from "node:fs/promises";

const filePath = new URL("../src/data/brawlers.json", import.meta.url);
const iconFields = [
  "bestGadgetIcon",
  "alternativeGadgetIcon",
  "bestStarPowerIcon",
];

const extractId = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/(\d+)(?=\/?$|\.png$|\.webp$|\.avif$|\.jpg$|\.jpeg$)/i);

  return match?.[1] ?? trimmed;
};

const source = await readFile(filePath, "utf8");
const brawlers = JSON.parse(source);

for (const brawler of brawlers) {
  for (const field of iconFields) {
    if (field in brawler) {
      brawler[field] = extractId(brawler[field]);
    }
  }

  if (Array.isArray(brawler.alternativeStarPowers)) {
    const [firstAlternative] = brawler.alternativeStarPowers;

    if (firstAlternative && !brawler.alternativeStarPower) {
      brawler.alternativeStarPower = firstAlternative;
    }

    delete brawler.alternativeStarPowers;
  }

  if (brawler.alternativeStarPower && typeof brawler.alternativeStarPower === "object") {
    brawler.alternativeStarPower = {
      ...brawler.alternativeStarPower,
      icon: extractId(brawler.alternativeStarPower.icon),
    };
  }
}

await writeFile(filePath, `${JSON.stringify(brawlers, null, 2)}\n`);

console.log(
  `Normalized ${brawlers.length} brawlers in src/data/brawlers.json (${iconFields.join(", ")}, alternativeStarPower.icon).`
);
