import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RISKS = ["critical", "high", "medium", "low", "info"];

const source = path.join(process.cwd(), "src", "data", "dorks.json");
const destDir = path.join(process.cwd(), "public");
const dest = path.join(destDir, "dorks.json");

const raw = JSON.parse(readFileSync(source, "utf8"));
if (!Array.isArray(raw.dorks)) {
  throw new Error("src/data/dorks.json has no dorks array");
}

const categories = [];
const subcategories = [];
const tags = [];
const categoryIndex = new Map();
const subcategoryIndex = new Map();
const tagIndex = new Map();
const sourceFiles = new Set();

function intern(list, map, value) {
  const existing = map.get(value);
  if (existing !== undefined) return existing;
  const id = list.length;
  list.push(value);
  map.set(value, id);
  return id;
}

const rows = raw.dorks.map((dork, index) => {
  if (typeof dork.query !== "string" || typeof dork.category !== "string" || typeof dork.subcategory !== "string") {
    throw new Error(`Invalid dork at index ${index}`);
  }
  if (typeof dork.sourceFile === "string") sourceFiles.add(dork.sourceFile);
  const risk = RISKS.indexOf(dork.riskLevel);
  if (risk < 0) throw new Error(`Unknown risk level: ${dork.riskLevel}`);
  const tagIds = Array.isArray(dork.tags)
    ? dork.tags.map((tag) => intern(tags, tagIndex, tag))
    : [];
  return [
    dork.query,
    intern(categories, categoryIndex, dork.category),
    intern(subcategories, subcategoryIndex, dork.subcategory),
    tagIds,
    risk,
  ];
});

mkdirSync(destDir, { recursive: true });
writeFileSync(
  dest,
  JSON.stringify({
    sourceFileCount: sourceFiles.size,
    categories,
    subcategories,
    tags,
    risks: RISKS,
    rows,
  }),
);
