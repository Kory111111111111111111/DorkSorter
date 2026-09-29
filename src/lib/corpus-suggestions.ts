import type { Dork } from "@/lib/dork";
import { RISK_ORDER, type RiskLevel } from "@/lib/risk";

/**
 * Operator value suggestions mined from the corpus: the most common file
 * types, domains, URL terms, title terms, body terms, anchor terms, and
 * quoted phrases. The Dork Builder feeds these into its value inputs.
 */

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

export interface CorpusSuggestions {
  total: number;
  filetype: SuggestionEntry[];
  site: SuggestionEntry[];
  inurl: SuggestionEntry[];
  intitle: SuggestionEntry[];
  intext: SuggestionEntry[];
  inanchor: SuggestionEntry[];
  phrase: SuggestionEntry[];
}

const TOP_N = 30;

// Token pattern: op:"quoted value" | op:(group) | op:bare | "standalone phrase"
const OPERATOR_TOKEN = /([a-z][a-z]*):("(?:[^"\\]|\\.)*"|\([^)]*\)|[^\s()|"]+)/gi;
const PHRASE_TOKEN = /"([^"]+)"/g;

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

function riskWeight(level: RiskLevel): number {
  return 1 + (RISK_ORDER.indexOf(level) === 0 ? 1 : 0) + (level === "high" ? 0.5 : 0);
}

function add(
  buckets: Record<SuggestionKey, Map<string, number>>,
  entry: string,
  bucket: SuggestionKey,
  weight: number,
) {
  const value = entry.trim().toLowerCase().replace(/^\./, "");
  if (!value || value.length > 80) return;
  buckets[bucket].set(value, (buckets[bucket].get(value) ?? 0) + weight);
}

function topEntries(bucket: Map<string, number>): SuggestionEntry[] {
  return Array.from(bucket.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);
}

export function mineSuggestions(dorks: Dork[]): CorpusSuggestions {
  const buckets: Record<SuggestionKey, Map<string, number>> = {
    filetype: new Map(),
    site: new Map(),
    inurl: new Map(),
    intitle: new Map(),
    intext: new Map(),
    inanchor: new Map(),
    phrase: new Map(),
  };

  for (const dork of dorks) {
    const weight = riskWeight(dork.riskLevel);

    let match: RegExpExecArray | null;
    OPERATOR_TOKEN.lastIndex = 0;
    while ((match = OPERATOR_TOKEN.exec(dork.query)) !== null) {
      const bucket = BUCKET_BY_OPERATOR[match[1].toLowerCase()];
      if (!bucket) continue;
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("(") && value.endsWith(")")) {
        value = value.slice(1, -1).split("|").join("|");
      }
      add(buckets, value, bucket, weight);
    }

    const withoutOperatorQuotes = dork.query.replace(OPERATOR_TOKEN, " ");
    PHRASE_TOKEN.lastIndex = 0;
    while ((match = PHRASE_TOKEN.exec(withoutOperatorQuotes)) !== null) {
      add(buckets, match[1], "phrase", weight);
    }
  }

  return {
    total: dorks.length,
    filetype: topEntries(buckets.filetype),
    site: topEntries(buckets.site),
    inurl: topEntries(buckets.inurl),
    intitle: topEntries(buckets.intitle),
    intext: topEntries(buckets.intext),
    inanchor: topEntries(buckets.inanchor),
    phrase: topEntries(buckets.phrase),
  };
}
