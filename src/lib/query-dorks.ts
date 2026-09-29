import type { Dork } from "@/lib/dork";

export type SortField = "risk" | "query" | "query-desc" | "category";

export interface CorpusMeta {
  globalTotal: number;
  sourceFileCount: number;
  categoryCounts: Record<string, number>;
}

export interface DorkQuery {
  query: string;
  categories: readonly string[];
  risk: string;
  tag: string;
  sort: SortField;
  page: number;
  perPage: number;
}

export interface DorkQueryResult {
  dorks: Dork[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
  globalTotal: number;
  sourceFileCount: number;
  categoryCounts: Record<string, number>;
  riskCounts: Record<string, number>;
}

const RISK_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function queryDorks(dorks: Dork[], meta: CorpusMeta, params: DorkQuery): DorkQueryResult {
  const query = params.query.toLowerCase();
  const page = Math.max(1, params.page);
  const perPage = Math.min(100, Math.max(20, params.perPage));

  let results = dorks;

  if (query) {
    results = results.filter(
      (dork) =>
        dork.query.toLowerCase().includes(query) ||
        dork.category.toLowerCase().includes(query) ||
        dork.subcategory.toLowerCase().includes(query) ||
        dork.tags.some((tag) => tag.includes(query))
    );
  }

  if (params.categories.length > 0) {
    const selected = new Set(params.categories);
    results = results.filter((dork) => selected.has(dork.category));
  }

  if (params.risk) {
    results = results.filter((dork) => dork.riskLevel === params.risk);
  }

  if (params.tag) {
    const tag = params.tag.toLowerCase();
    results = results.filter((dork) => dork.tags.some((value) => value.toLowerCase() === tag));
  }

  const sorted = results.slice();
  switch (params.sort) {
    case "query":
      sorted.sort((a, b) => a.query.localeCompare(b.query));
      break;
    case "query-desc":
      sorted.sort((a, b) => b.query.localeCompare(a.query));
      break;
    case "category":
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case "risk":
      sorted.sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 5) - (RISK_ORDER[b.riskLevel] ?? 5));
      break;
    default: {
      const exhaustive: never = params.sort;
      throw new Error(`Unhandled sort: ${exhaustive}`);
    }
  }

  const total = sorted.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;

  const riskCounts: Record<string, number> = {};
  for (const dork of sorted) {
    riskCounts[dork.riskLevel] = (riskCounts[dork.riskLevel] ?? 0) + 1;
  }

  return {
    dorks: sorted.slice(start, start + perPage),
    total,
    totalPages,
    page,
    perPage,
    globalTotal: meta.globalTotal,
    sourceFileCount: meta.sourceFileCount,
    categoryCounts: meta.categoryCounts,
    riskCounts,
  };
}
