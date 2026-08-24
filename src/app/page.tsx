"use client";

import { useRef, useState } from "react";
import { useDorks } from "@/hooks/use-dorks";
import { Sidebar, type AppView } from "@/components/sidebar";
import { DorkCard } from "@/components/dork-card";
import { DorkBuilder, type BuilderLoad } from "@/components/dork-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, Sparkles, SearchX, Wand2 } from "lucide-react";
import { RISK_LABELS, type RiskLevel } from "@/lib/risk";
import { parseQuery, withFreshIds } from "@/lib/dork-builder";
import type { DorkTemplate } from "@/lib/dork-templates";

export default function Home() {
  const {
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
  } = useDorks();

  const [view, setView] = useState<AppView>("browse");
  const [builderLoad, setBuilderLoad] = useState<BuilderLoad | null>(null);
  const loadNonce = useRef(0);

  const openInBuilder = (dorkQuery: string) => {
    loadNonce.current += 1;
    setBuilderLoad({ rows: parseQuery(dorkQuery), nonce: loadNonce.current });
    setView("builder");
  };

  const loadTemplate = (t: DorkTemplate) => {
    loadNonce.current += 1;
    setBuilderLoad({ rows: withFreshIds(t.rows), nonce: loadNonce.current });
    setView("builder");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        view={view}
        onViewChange={setView}
        query={query}
        onQueryChange={setSearchQuery}
        category={category}
        onCategoryChange={setCategoryFilter}
        risk={risk}
        onRiskChange={setRiskFilter}
        tag={tag}
        onTagChange={setTagFilter}
        onClearAll={clearAll}
        onLoadTemplate={loadTemplate}
        data={data}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b px-6 py-3 flex items-center gap-4 shrink-0 bg-background">
          {view === "browse" ? (
            <>
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <span className="text-sm text-muted-foreground">
                  {category || "All Categories"}
                  {risk && ` · ${RISK_LABELS[risk as RiskLevel]}`}
                  {tag && ` · #${tag}`}
                </span>
                {data && (
                  <Badge variant="secondary" className="text-xs">
                    {data.total.toLocaleString()} results
                  </Badge>
                )}
              </div>
              <Separator orientation="vertical" className="h-5" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Sort:</span>
                <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Risk ↑</SelectItem>
                    <SelectItem value="query">A–Z</SelectItem>
                    <SelectItem value="query-desc">Z–A</SelectItem>
                    <SelectItem value="category">Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Wand2 size={16} className="text-primary" />
              <span className="text-sm font-medium">Dork Builder</span>
              <span className="text-xs text-muted-foreground">
                compose queries from operators, then copy or run them
              </span>
            </div>
          )}
        </header>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto">
          {/* Browse view */}
          <div className={view === "browse" ? "block" : "hidden"}>
            <div className="p-4 max-w-4xl">
              {error && !loading && (
                <div className="flex items-center gap-2 p-4 text-sm text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300 rounded-lg mb-4">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Searching dorks...</span>
                </div>
              )}

              {!loading && !error && data && data.dorks.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <SearchX size={40} className="mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No dorks found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                  {(query || category || risk || tag) && (
                    <button
                      onClick={clearAll}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {!loading && data && (
                <>
                  <div className="space-y-2">
                    {data.dorks.map((dork) => (
                      <DorkCard
                        key={dork.id}
                        dork={dork}
                        onTag={setTagFilter}
                        onBuild={openInBuilder}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {data.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        Page {page} of {data.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= data.totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Builder view — kept mounted so in-progress work survives tab switches */}
          <div className={view === "builder" ? "block" : "hidden"}>
            <div className="p-4 max-w-4xl">
              <DorkBuilder load={builderLoad} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
