"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dork } from "@/lib/dork";
import { loadCorpus } from "@/lib/load-corpus";
import { queryDorks, summarizeCorpus, type DorkQueryResult, type SortField } from "@/lib/query-dorks";

export type { Dork } from "@/lib/dork";
export type { SortField, DorkQueryResult as DorksResponse } from "@/lib/query-dorks";

const PER_PAGE = 50;

export function useDorks() {
  const [corpus, setCorpus] = useState<Dork[] | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    loadCorpus()
      .then((dorks) => {
        if (cancelled) return;
        setCorpus(dorks);
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
  }, []);

  useEffect(() => {
    return () => {
      if (queryTimer.current) clearTimeout(queryTimer.current);
    };
  }, []);

  const meta = useMemo(() => (corpus ? summarizeCorpus(corpus) : null), [corpus]);

  const data: DorkQueryResult | null = useMemo(() => {
    if (!corpus || !meta) return null;
    return queryDorks(corpus, meta, {
      query: debouncedQuery,
      category,
      risk,
      tag,
      sort,
      page,
      perPage: PER_PAGE,
    });
  }, [corpus, meta, debouncedQuery, category, risk, tag, sort, page]);

  const setSearchQuery = (q: string) => {
    setQuery(q);
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => {
      setDebouncedQuery(q);
    }, 200);
  };

  const setCategoryFilter = (c: string) => {
    setCategory(c);
    setPageState(1);
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
    setCategory("");
    setRisk("");
    setTag("");
    setPageState(1);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    setDebouncedQuery("");
    setError(null);
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
