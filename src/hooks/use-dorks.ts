"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dork } from "@/lib/dork";
import { loadCorpus } from "@/lib/load-corpus";
import { queryDorks, type CorpusMeta, type DorkQueryResult, type SortField } from "@/lib/query-dorks";

export type { Dork } from "@/lib/dork";
export type { SortField, DorkQueryResult as DorksResponse } from "@/lib/query-dorks";

const PER_PAGE = 50;

export function useDorks() {
  const [corpus, setCorpus] = useState<Dork[] | null>(null);
  const [meta, setMeta] = useState<CorpusMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [risk, setRisk] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSortState] = useState<SortField>("risk");
  const [page, setPageState] = useState(1);

  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCorpus()
      .then((loaded) => {
        if (cancelled) return;
        setCorpus(loaded.dorks);
        setMeta(loaded.meta);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dorks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    return () => {
      if (queryTimer.current) clearTimeout(queryTimer.current);
    };
  }, []);

  const data: DorkQueryResult | null = useMemo(() => {
    if (!corpus || !meta) return null;
    return queryDorks(corpus, meta, {
      query: debouncedQuery,
      categories,
      risk,
      tag,
      sort,
      page,
      perPage: PER_PAGE,
    });
  }, [corpus, meta, debouncedQuery, categories, risk, tag, sort, page]);

  const retryLoad = () => {
    setLoading(true);
    setError(null);
    setLoadAttempt((attempt) => attempt + 1);
  };

  const setSearchQuery = (q: string) => {
    setQuery(q);
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      setDebouncedQuery(q);
    }, 200);
  };

  const setCategoryFilter = (category: string, shiftKey: boolean) => {
    setPageState(1);
    if (!category) {
      setCategories([]);
      return;
    }
    if (!shiftKey) {
      setCategories((prev) => (prev.length === 1 && prev[0] === category ? [] : [category]));
      return;
    }
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const setRiskFilter = (r: string) => {
    setRisk(r);
    setPageState(1);
  };

  const setTagFilter = (t: string) => {
    setTag((prev) => (prev === t ? "" : t));
    setPageState(1);
  };

  const setSort = (s: SortField) => {
    setSortState(s);
    setPageState(1);
  };

  const setPage = (p: number) => {
    setPageState(p);
  };

  const clearAll = () => {
    setQuery("");
    setCategories([]);
    setRisk("");
    setTag("");
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    setDebouncedQuery("");
  };

  return {
    data,
    loading,
    error,
    query,
    setSearchQuery,
    categories,
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
    retryLoad,
  };
}
