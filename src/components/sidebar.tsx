"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Moon, Sun, Wand2, Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { RISK_ITEMS } from "@/lib/risk";
import type { DorksResponse } from "@/hooks/use-dorks";
import { DORK_TEMPLATES, type DorkTemplate } from "@/lib/dork-templates";
import { cn } from "@/lib/utils";

export type AppView = "browse" | "builder";

interface SidebarProps {
  view: AppView;
  onViewChange: (v: AppView) => void;
  query: string;
  onQueryChange: (q: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  risk: string;
  onRiskChange: (r: string) => void;
  tag: string;
  onTagChange: (t: string) => void;
  onClearAll: () => void;
  onLoadTemplate: (t: DorkTemplate) => void;
  data: DorksResponse | null;
}

function useDarkMode() {
  // Read localStorage in the lazy initializer (client-only) so there is no
  // post-mount flash; the inline head script in layout.tsx already applied it
  // before first paint for the light case.
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("dorksorter-theme") !== "light";
  });

  // Keep the DOM class in sync with state — DOM writes are the allowed
  // effect use, no setState here.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("dorksorter-theme", next ? "dark" : "light");
    } catch {
      // ignore private-mode storage errors
    }
  };

  return { dark, toggle };
}

export function Sidebar({
  view,
  onViewChange,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  risk,
  onRiskChange,
  tag,
  onTagChange,
  onClearAll,
  onLoadTemplate,
  data,
}: SidebarProps) {
  const { dark, toggle: toggleDark } = useDarkMode();
  const hasFilters = query || category || risk || tag;

  const sortedCategories = data
    ? Object.entries(data.categoryCounts).sort((a, b) => b[1] - a[1])
    : [];

  const riskCounts = data?.riskCounts ?? {};
  const globalTotal = data?.globalTotal ?? 0;
  const sourceFileCount = data?.sourceFileCount ?? 0;

  return (
    <aside className="w-64 shrink-0 border-r flex flex-col bg-card min-h-0">
      {/* Header */}
      <div className="p-4 border-b shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Search size={20} className="text-primary" />
            DorkSorter
          </h1>
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle dark mode"
          >
            {dark ? (
              <Sun size={14} className="text-muted-foreground" />
            ) : (
              <Moon size={14} className="text-muted-foreground" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {globalTotal.toLocaleString()} dorks indexed
        </p>
      </div>

      {/* View tabs */}
      <div className="p-3 pt-2 border-b shrink-0">
        <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
          {(["browse", "builder"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                "flex-1 text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1",
                view === v
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v === "browse" ? (
                <>
                  <Search size={12} /> Browse
                </>
              ) : (
                <>
                  <Wand2 size={12} /> Builder
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {view === "browse" ? (
        <>
          {/* Search */}
          <div className="p-3 border-b shrink-0">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="Search dorks..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {hasFilters && (
              <button
                onClick={onClearAll}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <X size={12} /> Clear all filters
              </button>
            )}
          </div>

          {/* Filters — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-3 space-y-4">
              {/* Risk Levels — counts are for the current filtered result set */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                  <Filter size={12} /> Risk Level
                </h3>
                <p className="text-[10px] text-muted-foreground/70 mb-2">
                  counts within current results
                </p>
                <div className="space-y-1">
                  {RISK_ITEMS.map((item) => {
                    const count = riskCounts[item.value] ?? 0;
                    return (
                      <button
                        key={item.value}
                        onClick={() => onRiskChange(risk === item.value ? "" : item.value)}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors flex items-center justify-between ${
                          risk === item.value
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent text-foreground/80"
                        }`}
                      >
                        <span className="text-xs">{item.label}</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] text-center"
                        >
                          {count}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Categories — counts are always global */}
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                  Categories
                </h3>
                <p className="text-[10px] text-muted-foreground/70 mb-2">all dorks</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => onCategoryChange("")}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center justify-between ${
                      !category ? "bg-primary/10 text-primary font-medium" : "hover:bg-accent text-foreground/80"
                    }`}
                  >
                    <span>All Categories</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 ml-2">
                      {globalTotal.toLocaleString()}
                    </Badge>
                  </button>
                  {sortedCategories.map(([cat, count]) => (
                    <button
                      key={cat}
                      onClick={() => onCategoryChange(category === cat ? "" : cat)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded-md transition-colors flex items-center justify-between ${
                        category === cat
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-accent text-foreground/80"
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 ml-2">
                        {count.toLocaleString()}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active tag */}
              {tag && (
                <button
                  onClick={() => onTagChange(tag)}
                  className="w-full text-left text-xs px-2 py-1.5 rounded-md bg-primary/10 text-primary font-medium transition-colors"
                >
                  Tag: <span className="font-mono uppercase">{tag}</span> ✕
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Builder sidebar: templates — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Layers size={12} /> Templates
              </h3>
              <p className="text-[10px] text-muted-foreground/70 mb-2">
                click to load into the builder
              </p>
              <div className="space-y-0.5">
                {DORK_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onLoadTemplate(t)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                    title={t.description}
                  >
                    <span className="text-xs font-medium text-foreground/90">
                      {t.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground truncate">
                      {t.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="p-3 border-t text-[10px] text-muted-foreground shrink-0">
        {view === "builder"
          ? "Builder suggestions mined from the indexed corpus"
          : `Data parsed from ${sourceFileCount} source files`}
      </div>
    </aside>
  );
}
