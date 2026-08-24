"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, ExternalLink, Wand2 } from "lucide-react";
import type { Dork } from "@/hooks/use-dorks";
import { useEffect, useRef, useState } from "react";
import { RISK_BADGE_CLASSES, RISK_BORDER_COLORS, RISK_LABELS_EMOJI } from "@/lib/risk";
import { copyToClipboard } from "@/lib/clipboard";

export function DorkCard({
  dork,
  onTag,
  onBuild,
}: {
  dork: Dork;
  onTag?: (tag: string) => void;
  onBuild?: (query: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending copy-success timers on unmount
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = async () => {
    const ok = await copyToClipboard(dork.query);
    if (!ok) return; // leave the button inert rather than lying about success
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  };

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(dork.query)}`;

  return (
    <Card
      className="group hover:shadow-md transition-shadow border-l-4"
      style={{ borderLeftColor: RISK_BORDER_COLORS[dork.riskLevel] }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={`text-xs ${RISK_BADGE_CLASSES[dork.riskLevel]}`}>
                {RISK_LABELS_EMOJI[dork.riskLevel]}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {dork.category}
              </Badge>
              {dork.subcategory && dork.subcategory !== "Uncategorized" && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {dork.subcategory}
                </Badge>
              )}
            </div>
            <p className="font-mono text-sm break-all leading-relaxed text-foreground/90">
              {dork.query}
            </p>
            {dork.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {dork.tags.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onTag?.(tag)}
                    title={onTag ? `Filter by ${tag}` : undefined}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide select-none ${
                      onTag
                        ? "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {dork.tags.length > 6 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    +{dork.tags.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger
                className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
                onClick={handleCopy}
                aria-label="Copy dork"
              >
                <Copy size={14} className={copied ? "text-green-500" : "text-muted-foreground"} />
              </TooltipTrigger>
              <TooltipContent side="left">
                {copied ? "Copied!" : "Copy query"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
                onClick={() => window.open(googleSearchUrl, "_blank", "noopener,noreferrer")}
                aria-label="Try on Google"
              >
                <ExternalLink size={14} className="text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">Try on Google</TooltipContent>
            </Tooltip>
            {onBuild && (
              <Tooltip>
                <TooltipTrigger
                  className="p-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => onBuild(dork.query)}
                  aria-label="Open in builder"
                >
                  <Wand2 size={14} className="text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="left">Open in Builder</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}