import { readFileSync, writeFileSync } from "node:fs";
import { expandCompactIndex } from "../src/lib/load-corpus";
import { DEFAULT_BROWSE_QUERY, queryDorks } from "../src/lib/query-dorks";

const index: unknown = JSON.parse(readFileSync("public/dorks.json", "utf8"));
const loaded = expandCompactIndex(index);
const page = queryDorks(loaded.dorks, loaded.meta, DEFAULT_BROWSE_QUERY);
writeFileSync("public/dorks-first-page.json", JSON.stringify(page));
console.log(
  `first page: ${page.dorks.length} dorks, ${Buffer.byteLength(JSON.stringify(page))} bytes`,
);
