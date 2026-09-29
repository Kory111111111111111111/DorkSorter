import type { RiskLevel } from "@/lib/risk";

export interface Dork {
  id: string;
  query: string;
  category: string;
  subcategory: string;
  tags: string[];
  riskLevel: RiskLevel;
}
