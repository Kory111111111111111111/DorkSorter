import type { Dork } from "@/lib/dork";
import { publicPath } from "@/lib/public-path";
import type { CorpusMeta, DorkQueryResult } from "@/lib/query-dorks";
import { RISK_ORDER, type RiskLevel } from "@/lib/risk";

export interface LoadedCorpus {
  dorks: Dork[];
  meta: CorpusMeta;
}

interface CompactIndex {
  sourceFileCount: number;
  categories: string[];
  subcategories: string[];
  tags: string[];
  risks: string[];
  rows: Array<[string, number, number, number[], number]>;
}

let pending: Promise<LoadedCorpus> | null = null;
let pendingFirstPage: Promise<DorkQueryResult | null> | null = null;

function isQueryResult(value: unknown): value is DorkQueryResult {
  if (!value || typeof value !== "object") return false;
  const result = value as DorkQueryResult;
  return (
    Array.isArray(result.dorks) &&
    typeof result.total === "number" &&
    typeof result.page === "number" &&
    typeof result.perPage === "number" &&
    typeof result.globalTotal === "number" &&
    result.categoryCounts !== null &&
    typeof result.categoryCounts === "object" &&
    result.riskCounts !== null &&
    typeof result.riskCounts === "object"
  );
}

/** Default first page, or null when the file is missing. A miss must not fail the full index load. */
export function loadFirstPage(): Promise<DorkQueryResult | null> {
  if (!pendingFirstPage) {
    pendingFirstPage = fetch(publicPath("/dorks-first-page.json"))
      .then(async (res) => {
        if (!res.ok) return null;
        const json: unknown = await res.json();
        return isQueryResult(json) ? json : null;
      })
      .catch(() => null)
      .then((page) => {
        if (!page) pendingFirstPage = null;
        return page;
      });
  }
  return pendingFirstPage;
}

function isRiskLevel(value: string | undefined): value is RiskLevel {
  return value !== undefined && (RISK_ORDER as readonly string[]).includes(value);
}

function readRow(row: unknown): [string, number, number, number[], number] {
  if (!Array.isArray(row) || row.length !== 5) throw new Error("Invalid dork index");
  const [query, categoryId, subcategoryId, tagIds, riskId] = row;
  if (
    typeof query !== "string" ||
    !Number.isInteger(categoryId) ||
    !Number.isInteger(subcategoryId) ||
    !Number.isInteger(riskId) ||
    !Array.isArray(tagIds) ||
    tagIds.some((id) => !Number.isInteger(id))
  ) {
    throw new Error("Invalid dork index");
  }
  return [query, categoryId, subcategoryId, tagIds, riskId];
}

function expand(index: CompactIndex): LoadedCorpus {
  const categoryCounts: Record<string, number> = {};
  const dorks: Dork[] = index.rows.map((row, indexInCorpus) => {
    const [query, categoryId, subcategoryId, tagIds, riskId] = readRow(row);
    const category = index.categories[categoryId];
    const subcategory = index.subcategories[subcategoryId];
    const riskLevel = index.risks[riskId];
    if (category === undefined || subcategory === undefined || !isRiskLevel(riskLevel)) {
      throw new Error("Invalid dork index");
    }
    const tags = tagIds.map((id) => {
      const tag = index.tags[id];
      if (tag === undefined) throw new Error("Invalid dork index");
      return tag;
    });
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    return {
      id: String(indexInCorpus),
      query,
      category,
      subcategory,
      tags,
      riskLevel,
    };
  });

  return {
    dorks,
    meta: {
      globalTotal: dorks.length,
      sourceFileCount: index.sourceFileCount,
      categoryCounts,
    },
  };
}

function isCompactIndex(value: unknown): value is CompactIndex {
  if (!value || typeof value !== "object") return false;
  const index = value as Partial<CompactIndex>;
  return (
    typeof index.sourceFileCount === "number" &&
    Array.isArray(index.categories) &&
    Array.isArray(index.subcategories) &&
    Array.isArray(index.tags) &&
    Array.isArray(index.risks) &&
    Array.isArray(index.rows)
  );
}

/** Expand a compact index. Throws if a row does not match the packed shape. */
export function expandCompactIndex(value: unknown): LoadedCorpus {
  if (!isCompactIndex(value)) throw new Error("Invalid dork index");
  return expand(value);
}

/** Fetch the compact dork index once and share the expanded corpus. */
export function loadCorpus(): Promise<LoadedCorpus> {
  if (!pending) {
    pending = fetch(publicPath("/dorks.json"))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        return expandCompactIndex(json);
      })
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
