import { NextResponse } from "next/server";
import dorksData from "@/data/dorks.json";
import { RISK_ORDER, type RiskLevel } from "@/lib/risk";

/**
 * Serves operator value suggestions mined from the corpus: the most common
 * file types, domains, URL terms, title terms, body terms, anchor terms, and
 * quoted phrases that appear across all 14k dorks. The Dork Builder feeds
 * these into its value inputs as datalists.
 */

interface Dork {
  query: string;
  riskLevel: RiskLevel;
}

const dorks: Dork[] = dorksData.dorks as Dork[];

export interface SuggestionEntry {
  value: string;
  count: number;
}

export type SuggestionKey =
  | "filetype"
  | "site"
  | "inurl"
  | "intitle"
  | "intext"
  | "inanchor"
  | "phrase";

const TOP_N = 30;

// Token pattern: op:"quoted value" | op:(group) | op:bare | "standalone phrase"
const OPERATOR_TOKEN =
  /([a-z][a-z]*):("(?:[^"\\]|\\.)*"|\([^)]*\)|[^\s()|"]+)/gi;
const PHRASE_TOKEN = /"([^"]+)"/g;

// Operators whose values land in a specific suggestion bucket.
const BUCKET_BY_OPERATOR: Record<string, SuggestionKey> = {
  filetype: "filetype",
  ext: "filetype",
  site: "site",
  inurl: "inurl",
  allinurl: "inurl",
  intitle: "intitle",
  allintitle: "intitle",
  intext: "intext",
  allintext: "intext",
  inanchor: "inanchor",
  allinanchor: "inanchor",
};

// Boost counts from dorks with worse risk levels so dangerous combos surface.
function riskWeight(level: RiskLevel): number {
  return 1 + (RISK_ORDER.indexOf(level) === 0 ? 1 : 0) +
    (level === "high" ? 0.5 : 0);
}

const buckets: Record<SuggestionKey, Map<string, number>> = {
  filetype: new Map(),
  site: new Map(),
  inurl: new Map(),
  intitle: new Map(),
  intext: new Map(),
  inanchor: new Map(),
  phrase: new Map(),
};

function add(entry: string, bucket: SuggestionKey, weight: number) {
  const value = entry.trim().toLowerCase().replace(/^\./, "");
  if (!value || value.length > 80) return;
  buckets[bucket].set(value, (buckets[bucket].get(value) ?? 0) + weight);
}

for (const dork of dorks) {
  const weight = riskWeight(dork.riskLevel);

  // Operator:value pairs.
  let m: RegExpExecArray | null;
  OPERATOR_TOKEN.lastIndex = 0;
  while ((m = OPERATOR_TOKEN.exec(dork.query)) !== null) {
    const bucket = BUCKET_BY_OPERATOR[m[1].toLowerCase()];
    if (!bucket) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("(") && value.endsWith(")")) {
      value = value.slice(1, -1).split("|").join("|"); // keep groups as-is
    }
    add(value, bucket, weight);
  }

  // Standalone quoted phrases (strip operator-attached ones first).
  const withoutOperatorQuotes = dork.query.replace(OPERATOR_TOKEN, " ");
  PHRASE_TOKEN.lastIndex = 0;
  while ((m = PHRASE_TOKEN.exec(withoutOperatorQuotes)) !== null) {
    add(m[1], "phrase", weight);
  }
}

function topEntries(bucket: SuggestionKey): SuggestionEntry[] {
  return Array.from(buckets[bucket].entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

export async function GET() {
  return NextResponse.json({
    total: dorks.length,
    filetype: topEntries("filetype"),
    site: topEntries("site"),
    inurl: topEntries("inurl"),
    intitle: topEntries("intitle"),
    intext: topEntries("intext"),
    inanchor: topEntries("inanchor"),
    phrase: topEntries("phrase"),
  });
}
