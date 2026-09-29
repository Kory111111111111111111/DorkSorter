import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expandCompactIndex } from "@/lib/load-corpus";

const index = {
  sourceFileCount: 4,
  categories: ["Cameras", ""],
  subcategories: ["Uncategorized"],
  tags: ["iot"],
  risks: ["critical", "high", "medium", "low", "info"],
  rows: [
    ["intitle:camera", 0, 0, [0], 4],
    ["blank category", 1, 0, [], 0],
  ],
};

describe("expandCompactIndex", () => {
  it("rebuilds dorks and category counts from dictionary ids", () => {
    const loaded = expandCompactIndex(index);
    assert.equal(loaded.meta.sourceFileCount, 4);
    assert.equal(loaded.meta.globalTotal, 2);
    assert.deepEqual(loaded.meta.categoryCounts, { Cameras: 1, "": 1 });
    assert.equal(loaded.dorks[0]?.riskLevel, "info");
    assert.deepEqual(loaded.dorks[0]?.tags, ["iot"]);
    assert.equal("sourceFile" in (loaded.dorks[0] ?? {}), false);
    assert.equal(loaded.dorks[1]?.category, "");
  });

  it("rejects a row that is not the packed shape", () => {
    assert.throws(
      () => expandCompactIndex({ ...index, rows: [["only-query"]] }),
      /Invalid dork index/,
    );
  });
});
