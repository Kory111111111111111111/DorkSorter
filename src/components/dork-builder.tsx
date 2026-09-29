"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Combobox,
  ComboboxClear,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildQuery,
  countVariations,
  estimateRisk,
  generateVariations,
  isListValue,
  listLength,
  newRow,
  parseQuery,
  type BuilderRow,
  type LogicOp,
} from "@/lib/dork-builder";
import {
  KEYWORD_OPERATOR,
  OPERATORS,
  OPERATOR_GROUPS,
  OPERATOR_MAP,
  type SuggestionBucket,
} from "@/lib/dork-operators";
import { mineSuggestions, type SuggestionEntry, type SuggestionKey } from "@/lib/corpus-suggestions";
import { loadCorpus } from "@/lib/load-corpus";
import { RISK_BADGE_CLASSES, RISK_LABELS_EMOJI } from "@/lib/risk";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

export interface BuilderLoad {
  rows: BuilderRow[];
  nonce: number;
}

interface SuggestionsData {
  filetype: SuggestionEntry[];
  site: SuggestionEntry[];
  inurl: SuggestionEntry[];
  intitle: SuggestionEntry[];
  intext: SuggestionEntry[];
  inanchor: SuggestionEntry[];
  phrase: SuggestionEntry[];
}

/** Sentinel Select value for the plain-keyword operator (Base UI rejects ""). */
const KEYWORD_SENTINEL = "__keyword__";

/**
 * Select `items` map so `<Select.Value>` renders human labels instead of raw
 * values (Base UI shows the raw value unless `items` is provided).
 */
const OPERATOR_LABELS: Record<string, string> = Object.fromEntries(
  OPERATORS.map((op) => [
    op.value === "" ? KEYWORD_SENTINEL : op.value,
    `${op.label}${op.deprecated ? " (retired)" : ""}`,
  ])
);

/** Map an operator's suggestion bucket to the suggestions response key. */
function bucketToKey(bucket: SuggestionBucket): SuggestionKey {
  return bucket;
}

// --- Query preview with lightweight syntax coloring ---

function HighlightedQuery({ query }: { query: string }) {
  const tokens = query.split(" ");
  if (!query.trim()) {
    return (
      <span className="text-muted-foreground">
        Add rows below to build your query…
      </span>
    );
  }
  return (
    <p className="font-mono text-sm break-all leading-relaxed text-foreground/90">
      {tokens.map((t, i) => {
        const isExcluded = t.startsWith("-");
        const isOperator = /^[a-z]+:/.test(t) || /^AROUND\(\d+\)$/i.test(t);
        return (
          <span key={i}>
            <span
              className={
                isExcluded
                  ? "text-red-400"
                  : isOperator
                    ? "text-cyan-400"
                    : "text-foreground/90"
              }
            >
              {t}
            </span>
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

// --- Single row editor ---

function RowEditor({
  row,
  index,
  total,
  suggestions,
  onChange,
  onRemove,
}: {
  row: BuilderRow;
  index: number;
  total: number;
  suggestions: SuggestionsData | null;
  onChange: (patch: Partial<BuilderRow>) => void;
  onRemove: () => void;
}) {
  const operator = OPERATOR_MAP[row.operator.toLowerCase()] ?? KEYWORD_OPERATOR;
  const suggestionKey = operator.suggestions
    ? bucketToKey(operator.suggestions)
    : null;
  const entries = suggestionKey ? suggestions?.[suggestionKey] ?? null : null;
  const suggestionItems = useMemo(
    () => (entries ? entries.map((e) => e.value) : []),
    [entries]
  );
  const isList = isListValue(row.value);
  const nValues = isList ? listLength(row.value) : 0;
  const valueLabel = `Value for ${operator.label || "keyword"}`;

  return (
    <div className="flex items-center gap-2">
      {/* Logic */}
      <Select
        value={row.logic}
        disabled={index === 0}
        onValueChange={(v) => onChange({ logic: v as LogicOp })}
      >
        <SelectTrigger
          size="sm"
          title={
            index === 0
              ? "The first row is always implicit AND"
              : "How this row combines with the previous one"
          }
          className={cn(
            "w-[74px] shrink-0 font-mono text-xs",
            row.logic === "NOT" && "text-red-400",
            row.logic === "OR" && "text-amber-400"
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[90px]">
          <SelectItem value="AND" label="AND">
            AND
          </SelectItem>
          <SelectItem value="OR" label="OR">
            <span className="text-amber-400">OR</span>
          </SelectItem>
          <SelectItem value="NOT" label="NOT">
            <span className="text-red-400">NOT</span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select
        value={row.operator === "" ? KEYWORD_SENTINEL : row.operator}
        items={OPERATOR_LABELS}
        onValueChange={(v) =>
          // Base UI emits null when cleared; the sentinel maps back to keyword.
          onChange({ operator: !v || v === KEYWORD_SENTINEL ? "" : v })
        }
      >
        <SelectTrigger
          size="sm"
          title={operator.description}
          className="w-[136px] shrink-0 font-mono text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[240px]">
          {OPERATOR_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.operators.map((op) => (
                <SelectItem
                  key={op.value}
                  value={op.value === "" ? KEYWORD_SENTINEL : op.value}
                  label={`${op.label}${op.deprecated ? " (retired)" : ""}`}
                >
                  <span className="font-mono">
                    {op.label}
                    {op.deprecated ? " (retired)" : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      {/* Value — combobox with corpus suggestions, or a plain input */}
      {suggestionItems.length > 0 ? (
        <Combobox
          items={suggestionItems}
          inputValue={row.value}
          onInputValueChange={(v) => onChange({ value: v })}
          onValueChange={(v) => onChange({ value: v ?? "" })}
        >
          <ComboboxInputGroup className="flex-1 min-w-0">
            <ComboboxInput
              placeholder={operator.placeholder}
              className="font-mono text-xs"
              aria-label={valueLabel}
            />
            <ComboboxClear aria-label="Clear value" />
            <ComboboxTrigger aria-label="Show suggestions" />
          </ComboboxInputGroup>
          <ComboboxPopup className="min-w-[220px]">
            <ComboboxEmpty>Keep typing — any value works</ComboboxEmpty>
            <ComboboxList>
              {(item) => (
                <ComboboxItem key={item} value={item}>
                  <span className="font-mono text-xs">{item}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      ) : (
        <Input
          value={row.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={operator.placeholder}
          className="font-mono text-xs flex-1 min-w-0"
          aria-label={valueLabel}
        />
      )}

      {/* List badge */}
      {isList && (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
          {nValues} values
        </span>
      )}

      {/* Remove */}
      <Tooltip>
        <TooltipTrigger
          className="p-1.5 rounded-md hover:bg-destructive/15 hover:text-destructive transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
          onClick={onRemove}
          disabled={total === 1}
          aria-label="Remove row"
        >
          <X size={14} className="text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {total === 1 ? "Keep at least one row" : "Remove row"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// --- The builder ---

export function DorkBuilder({ load }: { load: BuilderLoad | null }) {
  const [rows, setRows] = useState<BuilderRow[]>(() => load?.rows ?? [newRow()]);
  const [copied, setCopied] = useState(false);
  const [loadText, setLoadText] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionsData | null>(null);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [variationsOpen, setVariationsOpen] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt externally-provided rows (template click / dork card action) when a
  // new load object arrives. Adjusting state during render (instead of in an
  // effect) is the React-recommended way to sync state with a changing prop.
  const [lastLoad, setLastLoad] = useState<BuilderLoad | null>(load);
  if (load !== lastLoad) {
    setLastLoad(load);
    setRows(load ? load.rows : [newRow()]);
  }

  // Fetch corpus-derived value suggestions once.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const { dorks } = await loadCorpus();
        if (controller.signal.aborted) return;
        setSuggestions(mineSuggestions(dorks));
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setSuggestionsError(true);
      }
    })();
    return () => controller.abort();
  }, []);

  // Cleanup timers.
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const query = useMemo(() => buildQuery(rows), [rows]);
  const risk = useMemo(() => estimateRisk(rows), [rows]);
  const varCount = useMemo(() => countVariations(rows), [rows]);
  const variations = useMemo(
    () => (varCount > 1 ? generateVariations(rows) : []),
    [rows, varCount]
  );

  const updateRow = (id: string, patch: Partial<BuilderRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const clearAll = () => {
    setRows([newRow()]);
    setVariationsOpen(false);
  };

  const handleCopy = async () => {
    if (!query) return;
    const ok = await copyToClipboard(query);
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const openInGoogle = () => {
    if (!query) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const applyLoadText = () => {
    const parsed = parseQuery(loadText);
    if (parsed.length === 0) return;
    setRows(parsed);
    setVariationsOpen(false);
  };

  const copyAllVariations = async () => {
    if (variations.length === 0) return;
    const ok = await copyToClipboard(variations.join("\n"));
    if (!ok) return;
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-4">
      {/* Query rows */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Wand2 size={14} className="text-primary" />
              Query rows
            </h2>
            <span className="text-[10px] text-muted-foreground">
              Tip: separate values with <code className="font-mono">|</code> to
              generate variations
            </span>
          </div>

          {rows.map((row, i) => (
            <RowEditor
              key={row.id}
              row={row}
              index={i}
              total={rows.length}
              suggestions={suggestions}
              onChange={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
            />
          ))}

          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus /> Add row
            </Button>
            {suggestionsError && (
              <span className="text-[10px] text-muted-foreground">
                Value suggestions unavailable
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Built query */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <h2 className="text-sm font-semibold">Built query</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!query}
              >
                {copied ? "Copied!" : (
                  <>
                    <Copy /> Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openInGoogle}
                disabled={!query}
              >
                <ExternalLink /> Google
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={!query}
                title="Clear all rows"
              >
                <Trash2 /> Clear
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 min-h-[48px]">
            <HighlightedQuery query={query} />
          </div>

          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Badge className={RISK_BADGE_CLASSES[risk.level]}>
              {RISK_LABELS_EMOJI[risk.level]}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              heuristic risk estimate
            </span>
            {varCount > 1 && (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setVariationsOpen((v) => !v)}
                className="ml-auto"
              >
                {variationsOpen ? "Hide" : `${varCount} variations`}
              </Button>
            )}
          </div>

          {risk.reasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {risk.reasons.map((r) => (
                <span
                  key={r}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Variations */}
      {variationsOpen && variations.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                Generated variations
                <Badge variant="secondary" className="text-[10px]">
                  {variations.length}
                  {varCount > variations.length
                    ? ` of ${varCount} (capped)`
                    : ""}
                </Badge>
              </h2>
              <Button variant="outline" size="sm" onClick={copyAllVariations}>
                <Copy /> Copy all
              </Button>
            </div>
            <ScrollArea className="h-64 rounded-lg border bg-muted/20">
              <div className="p-2 space-y-1">
                {variations.slice(0, 100).map((v, i) => (
                  <div
                    key={i}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                  >
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0 text-right">
                      {i + 1}.
                    </span>
                    <span className="font-mono text-xs break-all flex-1 min-w-0">
                      {v}
                    </span>
                    <button
                      onClick={async () => {
                        const ok = await copyToClipboard(v);
                        if (ok) {
                          setCopied(true);
                          if (copyTimer.current) clearTimeout(copyTimer.current);
                          copyTimer.current = setTimeout(
                            () => setCopied(false),
                            1200
                          );
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-opacity cursor-pointer"
                      aria-label="Copy variation"
                    >
                      <Copy size={12} className="text-muted-foreground" />
                    </button>
                  </div>
                ))}
                {variations.length > 100 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1">
                    +{variations.length - 100} more — “Copy all” includes
                    everything
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Load existing dork */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold mb-1">
            Load an existing dork
          </h2>
          <p className="text-[10px] text-muted-foreground mb-2">
            Paste any dork query to pull it into the builder for tweaking
            (copy one from the Browse tab).
          </p>
          <div className="flex items-start gap-2">
            <Textarea
              value={loadText}
              onChange={(e) => setLoadText(e.target.value)}
              placeholder='e.g. inurl:admin intitle:"index of" -filetype:html'
              className="font-mono text-xs min-h-[52px] flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={applyLoadText}
              disabled={!loadText.trim()}
              className="h-[52px]"
            >
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions loading state */}
      {!suggestions && !suggestionsError && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Mining value suggestions from the corpus…
        </div>
      )}
    </div>
  );
}
