import { NextResponse } from "next/server";
import dorksData from "@/data/dorks.json";

interface Dork {
  id: string;
  query: string;
  category: string;
  subcategory: string;
  tags: string[];
  sourceFile: string;
  riskLevel: "critical" | "high" | "medium" | "low" | "info";
}

const dorks: Dork[] = dorksData.dorks as Dork[];

// Global metadata, precomputed once at module load.
// Note: search is a plain substring scan with no index — a known tradeoff at
// this corpus size (14k). If the corpus grows an order of magnitude, add a
// prepared index or move to SQLite FTS rather than scaling this loop.
const GLOBAL_CATEGORY_COUNTS: Record<string, number> = {};
const GLOBAL_SOURCE_FILE_COUNT = new Set<string>();
for (const d of dorks) {
  GLOBAL_CATEGORY_COUNTS[d.category] = (GLOBAL_CATEGORY_COUNTS[d.category] || 0) + 1;
  GLOBAL_SOURCE_FILE_COUNT.add(d.sourceFile);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q")?.toLowerCase() || "";
  const category = searchParams.get("category") || "";
  const risk = searchParams.get("risk") || "";
  const tag = searchParams.get("tag") || "";
  const sort = searchParams.get("sort") || "risk";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(100, Math.max(20, parseInt(searchParams.get("perPage") || "50")));

  // Filter
  let results = dorks;

  if (query) {
    const q = query;
    results = results.filter(
      (d) =>
        d.query.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.subcategory.toLowerCase().includes(q) ||
        d.tags.some((t) => t.includes(q)) ||
        d.sourceFile.toLowerCase().includes(q)
    );
  }

  if (category) {
    results = results.filter((d) => d.category === category);
  }

  if (risk) {
    results = results.filter((d) => d.riskLevel === risk);
  }

  if (tag) {
    const t = tag.toLowerCase();
    results = results.filter((d) => d.tags.some((x) => x.toLowerCase() === t));
  }

  // Sort
  const riskOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  switch (sort) {
    case "query":
      results.sort((a, b) => a.query.localeCompare(b.query));
      break;
    case "query-desc":
      results.sort((a, b) => b.query.localeCompare(a.query));
      break;
    case "category":
      results.sort((a, b) => a.category.localeCompare(b.category));
      break;
    case "risk":
    default:
      results.sort((a, b) => {
        const ra = riskOrder[a.riskLevel] ?? 5;
        const rb = riskOrder[b.riskLevel] ?? 5;
        return ra - rb;
      });
      break;
  }

  // Paginate
  const total = results.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (page - 1) * perPage;
  const paged = results.slice(start, start + perPage);

  // Category counts are always global so the sidebar shows all categories
  // Risk counts come from the filtered set so within-category risk drilldown works
  const riskCounts: Record<string, number> = {};
  for (const d of results) {
    riskCounts[d.riskLevel] = (riskCounts[d.riskLevel] || 0) + 1;
  }

  return NextResponse.json({
    dorks: paged,
    total,
    totalPages,
    page,
    perPage,
    globalTotal: dorks.length,
    sourceFileCount: GLOBAL_SOURCE_FILE_COUNT.size,
    categoryCounts: GLOBAL_CATEGORY_COUNTS,
    riskCounts,
  });
}