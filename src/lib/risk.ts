/**
 * Single source of truth for risk levels: ordering, labels, badge colors,
 * and card accent colors. Import from here — never re-declare per file.
 */

export type RiskLevel = "critical" | "high" | "medium" | "low" | "info";

export const RISK_ORDER: RiskLevel[] = ["critical", "high", "medium", "low", "info"];

export const RISK_ITEMS: Array<{ value: RiskLevel; label: string }> = [
  { value: "critical", label: "🔴 Critical" },
  { value: "high", label: "🟠 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low", label: "🟢 Low" },
  { value: "info", label: "⚪ Info" },
];

export const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const RISK_LABELS_EMOJI: Record<RiskLevel, string> = {
  critical: "🔴 Critical",
  high: "🟠 High",
  medium: "🟡 Medium",
  low: "🟢 Low",
  info: "⚪ Info",
};

/** Badge classes for the dark theme (the only shipped theme). */
export const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  critical: "bg-red-950/60 text-red-400 border-red-800",
  high: "bg-orange-950/60 text-orange-400 border-orange-800",
  medium: "bg-yellow-950/60 text-yellow-400 border-yellow-800",
  low: "bg-green-950/60 text-green-400 border-green-800",
  info: "bg-slate-800/60 text-slate-400 border-slate-700",
};

/** Card accent border colors. */
export const RISK_BORDER_COLORS: Record<RiskLevel, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#94a3b8",
};

/** Sort comparator: risk-first ordering. */
export function riskRank(level: RiskLevel): number {
  return RISK_ORDER.indexOf(level);
}