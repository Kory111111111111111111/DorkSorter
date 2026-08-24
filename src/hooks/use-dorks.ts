"use client";

import { useEffect, useRef, useState } from "react";

export interface Dork {
  id: string;
  query: string;
  category: string;
  subcategory: string;
  tags: string[];
  sourceFile: string;
  riskLevel: "critical" | "high" | "medium" | "low" | "info";
}

export interface DorksResponse {
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

export type SortField = "risk" | "query" | "query-desc" | "category";

const PER_PAGE = 50;

export function useDorks() {
  const [data, setData] = useState<DorksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState("");
  const [risk, setRisk] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSortState] = useState<SortField>("risk");
  const [page, setPageState] = useState(1);

  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch on any filter change. AbortController guards against races:
  // a slow stale response can never overwrite a newer one.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (category) params.set("category", category);
        if (risk) params.set("risk", risk);
        if (tag) params.set("tag", tag);
        params.set("sort", sort);
        params.set("page", String(page));
        params.set("perPage", String(PER_PAGE));

        const res = await fetch(`/api/dorks?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as DorksResponse;
        // A stale error banner must never outlive a successful request.
        setError(null);
        setData(json);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to fetch dorks");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery, category, risk, tag, sort, page]);

  // Cleanup the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (queryTimer.current) clearTimeout(queryTimer.current);
    };
  }, []);

  const setSearchQuery = (q: string) => {
    setQuery(q);
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      setDebouncedQuery(q);
      setLoading(true);
    }, 200);
  };

  const setCategoryFilter = (c: string) => {
    setCategory(c);
    setPageState(1);
    setLoading(true);
  };

  const setRiskFilter = (r: string) => {
    setRisk(r);
    setPageState(1);
    setLoading(true);
  };

  const setTagFilter = (t: string) => {
    // Toggle: clicking the active tag clears it.
    setTag((prev) => (prev === t ? "" : t));
    setPageState(1);
    setLoading(true);
  };

  const setSort = (s: SortField) => {
    setSortState(s);
    setPageState(1);
    setLoading(true);
  };

  const setPage = (p: number) => {
    setPageState(p);
    setLoading(true);
  };

  const clearAll = () => {
    setQuery("");
    setCategory("");
    setRisk("");
    setTag("");
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    setDebouncedQuery("");
    setError(null);
    setLoading(true);
  };

  return {
    data,
    loading,
    error,
    query,
    setSearchQuery,
    category,
    setCategoryFilter,
    risk,
    setRiskFilter,
    tag,
    setTagFilter,
    sort,
    setSort,
    page,
    setPage,
    clearAll,
  };
}