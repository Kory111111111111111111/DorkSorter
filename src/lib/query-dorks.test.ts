import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Dork } from "@/lib/dork";
import { queryDorks, type CorpusMeta } from "@/lib/query-dorks";

function dork(partial: Pick<Dork, "id" | "query" | "category" | "riskLevel"> & Partial<Dork>): Dork {
  return {
    subcategory: "Uncategorized",
    tags: [],
    ...partial,
  };
}

const meta: CorpusMeta = {
  globalTotal: 3,
  sourceFileCount: 2,
  categoryCounts: { Cameras: 1, LFI: 1, General: 1 },
};

const corpus: Dork[] = [
  dork({ id: "1", query: "intitle:camera", category: "Cameras", riskLevel: "info", tags: ["IoT"] }),
  dork({ id: "2", query: "inurl:etc/passwd", category: "LFI", riskLevel: "critical", tags: ["lfi"] }),
  dork({ id: "3", query: "index of", category: "General", subcategory: "Listings", riskLevel: "low" }),
];

const base = {
  query: "",
  categories: [] as string[],
  risk: "",
  tag: "",
  sort: "risk" as const,
  page: 1,
  perPage: 50,
};

describe("queryDorks", () => {
  it("sorts by risk without mutating the corpus", () => {
    const before = corpus.map((item) => item.id);
    const result = queryDorks(corpus, meta, base);
    assert.deepEqual(
      result.dorks.map((item) => item.id),
      ["2", "3", "1"],
    );
    assert.deepEqual(
      corpus.map((item) => item.id),
      before,
    );
  });

  it("unions selected categories", () => {
    const result = queryDorks(corpus, meta, { ...base, categories: ["Cameras", "LFI"] });
    assert.deepEqual(
      result.dorks.map((item) => item.category).sort(),
      ["Cameras", "LFI"],
    );
    assert.equal(result.total, 2);
  });

  it("matches tags and surrounding whitespace case-insensitively", () => {
    const result = queryDorks(corpus, meta, { ...base, query: "  IOT " });
    assert.deepEqual(
      result.dorks.map((item) => item.id),
      ["1"],
    );
  });

  it("matches subcategory text", () => {
    const result = queryDorks(corpus, meta, { ...base, query: "listings" });
    assert.deepEqual(
      result.dorks.map((item) => item.id),
      ["3"],
    );
  });

  it("paginates after the minimum page size", () => {
    const many = Array.from({ length: 21 }, (_, index) =>
      dork({ id: String(index), query: `q${index}`, category: "General", riskLevel: "info" }),
    );
    const result = queryDorks(many, { ...meta, globalTotal: 21 }, { ...base, page: 2, perPage: 20 });
    assert.equal(result.perPage, 20);
    assert.equal(result.dorks.length, 1);
    assert.equal(result.totalPages, 2);
  });
});
