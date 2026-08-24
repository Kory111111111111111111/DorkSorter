/**
 * Core logic for the Dork Builder: row model, query assembly, round-trip
 * parsing, heuristic risk estimation, and multi-value variation generation.
 *
 * Pure functions only — no React here, so this is unit-testable and safe to
 * import from server and client code alike.
 */

import { RISK_ORDER, type RiskLevel } from "./risk";
import {
  KEYWORD_OPERATOR,
  OPERATOR_MAP,
  isBooleanToken,
  normalizeOperator,
  type DorkOperator,
} from "./dork-operators";

export type LogicOp = "AND" | "OR" | "NOT";

export interface BuilderRow {
  id: string;
  logic: LogicOp;
  /** Canonical operator value, e.g. "site:" — "" is a plain keyword. */
  operator: string;
  /** Raw value text. May contain a list (`|` or newline separated). */
  value: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
}

// --- Identity ---

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function newRow(overrides: Partial<BuilderRow> = {}): BuilderRow {
  return {
    id: uid(),
    logic: "AND",
    operator: KEYWORD_OPERATOR.value,
    value: "",
    ...overrides,
  };
}

export function withFreshIds(rows: Omit<BuilderRow, "id">[]): BuilderRow[] {
  return rows.map((r) => ({ ...r, id: uid() }));
}

// --- Value lists ---

const LIST_SEPARATOR = /[|\n]/;

/** Whether a value contains a multi-value list (pipe or newline separated). */
export function isListValue(value: string): boolean {
  return LIST_SEPARATOR.test(value);
}

/** Split a possibly-list value into distinct items. */
export function splitList(value: string): string[] {
  const items = value
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(items)];
}

/** Number of distinct values in a row's list (1 when not a list). */
export function listLength(value: string): number {
  if (!isListValue(value)) return 1;
  return Math.max(1, splitList(value).length);
}

// --- Query assembly ---

function quoteIfNeeded(value: string): string {
  const v = value.trim();
  if (!v) return v;
  // Already quoted (either single or double) or parenthesized — leave alone.
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("(") && v.endsWith(")"))
  ) {
    return v;
  }
  // Quote when the value contains whitespace, or a colon that Google could
  // misread as an operator prefix (e.g. "MySQL_ROOT_PASSWORD:").
  return /\s|:/.test(v) ? `"${v}"` : v;
}

function renderTerm(row: BuilderRow): string {
  const value = row.value.trim();
  if (!value) return "";

  if (row.operator === "AROUND(n)") {
    const n = value.replace(/\D/g, "");
    return n ? `AROUND(${n})` : "";
  }

  if (row.operator === "") {
    return quoteIfNeeded(value);
  }

  return `${row.operator}${quoteIfNeeded(value)}`;
}

/**
 * Assemble rows into a Google search query string.
 * First row's logic is ignored; NOT renders as `-term`, OR as ` OR `, AND as a space.
 */
export function buildQuery(rows: BuilderRow[]): string {
  const parts: string[] = [];

  rows.forEach((row, i) => {
    const term = renderTerm(row);
    if (!term) return;

    if (i === 0) {
      // The first row ignores AND/OR, but a leading exclusion is meaningful
      // (e.g. a query that is only `-site:example.com`).
      parts.push(row.logic === "NOT" ? `-${term}` : term);
      return;
    }

    switch (row.logic) {
      case "OR":
        parts.push(`OR ${term}`);
        break;
      case "NOT":
        parts.push(`-${term}`);
        break;
      case "AND":
      default:
        parts.push(term);
    }
  });

  return parts.join(" ");
}

/** Serialize rows to a query string that parseQuery can round-trip, keeping lists. */
export function serializeRows(rows: BuilderRow[]): string {
  return rows
    .map((row) => {
      const term = renderTerm(row);
      if (!term) return "";
      if (row.logic === "NOT" && term) return `-${term}`;
      return term;
    })
    .filter(Boolean)
    .join(" ");
}

// --- Parsing ---

const OPERATOR_TOKEN = /^([a-z][a-z]*):(.*)$/i;

function stripOuterQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parse a raw query string into builder rows. Understands quotes, `-` exclusion,
 * known operators (incl. aliases like `ext:`), boolean OR/AND keywords, and
 * AROUND(n) proximity markers.
 */
export function parseQuery(query: string): BuilderRow[] {
  // Tokenize on spaces while keeping quoted phrases intact. An operator glued
  // to its quoted value (intitle:"index of") must stay one token, otherwise
  // the value picks up a stray quote and a phantom keyword row appears.
  const tokens = query.match(/-?[a-z]+:"[^"]*"|-?"[^"]*"|\S+/g) ?? [];
  const rows: BuilderRow[] = [];
  let pendingLogic: LogicOp = "AND";

  for (const rawToken of tokens) {
    let token = rawToken;
    let logic: LogicOp = pendingLogic;
    pendingLogic = "AND";

    const bool = isBooleanToken(token);
    if (bool) {
      pendingLogic = bool;
      continue;
    }

    if (token.startsWith("-")) {
      logic = "NOT";
      token = token.slice(1);
    }

    const around = token.match(/^AROUND\((\d+)\)$/i);
    if (around) {
      rows.push(newRow({ logic, operator: "AROUND(n)", value: around[1] }));
      continue;
    }

    const opMatch = token.match(OPERATOR_TOKEN);
    if (opMatch) {
      const canonical = normalizeOperator(opMatch[1]);
      if (canonical !== null) {
        rows.push(
          newRow({
            logic,
            operator: canonical,
            value: stripOuterQuotes(opMatch[2]),
          })
        );
        continue;
      }
    }

    rows.push(newRow({ logic, operator: "", value: stripOuterQuotes(token) }));
  }

  return rows;
}

// --- Risk estimation (heuristic) ---

const FILETYPE_RISK: Record<string, RiskLevel> = {
  sql: "critical", pwd: "critical", bak: "critical", env: "critical",
  ini: "critical", reg: "critical", key: "critical", pem: "critical",
  p12: "critical", pfx: "critical", db: "critical", dmp: "critical",
  pcf: "high", ovpn: "high",
  conf: "high", cfg: "high", php: "high", asp: "high", aspx: "high",
  jsp: "high", log: "high", json: "high", yml: "high", yaml: "high",
  sh: "high", py: "medium", rb: "medium", js: "medium",
  xls: "medium", xlsx: "medium", csv: "medium",
  zip: "medium", tar: "medium", gz: "medium", rar: "medium",
  doc: "low", docx: "low", pdf: "low", txt: "info", html: "info",
};

const URL_WORD_RISK: Record<string, RiskLevel> = {
  ".env": "critical", ".git": "critical", ".svn": "critical",
  password: "critical", passwd: "critical", secret: "critical",
  credentials: "critical", "wp-config": "critical",
  admin: "high", "wp-admin": "high", config: "high", backup: "high",
  phpmyadmin: "high", database: "high", dump: "high", swagger: "high",
  ".aws": "high", ".ssh": "high", id_rsa: "critical", shadow: "critical",
  login: "medium", signin: "medium", auth: "medium", upload: "medium",
  api: "medium", panel: "medium", cpanel: "medium", webmail: "medium",
};

const TITLE_WORD_RISK: Record<string, RiskLevel> = {
  "index of": "high", "index.of": "high",
  password: "critical", "login": "medium", admin: "high",
  "phpinfo": "medium", "test page for apache": "low",
  "webcam": "medium", "live view": "medium", "network camera": "medium",
};

const SITE_RISK: Record<string, RiskLevel> = {
  ".gov": "high", ".mil": "high", ".edu": "medium",
  "s3.amazonaws.com": "high", "amazonaws.com": "medium",
  "github.com": "medium", "gist.github.com": "medium",
  "pastebin.com": "medium", "dropbox.com": "low", "drive.google.com": "low",
};

const KEYWORD_RISK: Record<string, RiskLevel> = {
  password: "critical", passwd: "critical", secret: "critical",
  credentials: "critical", "api key": "critical", "api_key": "critical",
  "private key": "critical", "BEGIN RSA": "critical", token: "high",
  "access key": "critical", "access_key": "critical", "SECRET_KEY": "critical",
  backup: "high", dump: "high", config: "high", admin: "high",
  "sql dump": "critical", "database": "medium", confidential: "high",
  "index of": "high", "parent directory": "high", "webcam": "medium",
};

function riskIndex(level: RiskLevel): number {
  return RISK_ORDER.indexOf(level);
}

function pickWorse(a: RiskLevel, b: RiskLevel): RiskLevel {
  return riskIndex(a) <= riskIndex(b) ? a : b;
}

/** Estimate the risk level of an assembled dork from its operator/value mix. */
export function estimateRisk(rows: BuilderRow[]): RiskAssessment {
  const reasons: string[] = [];
  let level: RiskLevel = "info";
  let highCount = 0;
  let mediumCount = 0;

  const consider = (candidate: RiskLevel | undefined, reason: string) => {
    if (!candidate) return;
    if (candidate === "high") highCount += 1;
    if (candidate === "medium") mediumCount += 1;
    if (!reasons.includes(reason)) reasons.push(reason);
    level = pickWorse(level, candidate);
  };

  for (const row of rows) {
    const op = OPERATOR_MAP[row.operator.toLowerCase()] as DorkOperator | undefined;
    const raw = row.value.trim();
    if (!raw) continue;

    for (const item of splitList(raw)) {
      const value = item.toLowerCase();
      const reason = `${row.operator || "keyword"} ${item}`;

      if (row.operator === "filetype:") {
        consider(FILETYPE_RISK[value.replace(/^\./, "")], reason);
        continue;
      }
      if (row.operator === "site:") {
        consider(SITE_RISK[value], reason);
        for (const [suffix, r] of Object.entries(SITE_RISK)) {
          if (suffix.startsWith(".") && value.endsWith(suffix)) {
            consider(r, reason);
            break;
          }
        }
        continue;
      }
      if (row.operator === "inurl:" || row.operator === "allinurl:") {
        consider(URL_WORD_RISK[value], reason);
        for (const [word, r] of Object.entries(URL_WORD_RISK)) {
          if (word.startsWith(".") && value.includes(word)) {
            consider(r, reason);
            break;
          }
        }
        continue;
      }
      if (row.operator === "intext:" || row.operator === "allintext:") {
        consider(URL_WORD_RISK[value], reason);
        consider(TITLE_WORD_RISK[value], reason);
        // Sensitive words buried in longer values (e.g. enc_UserPassword=*).
        for (const [word, r] of Object.entries(URL_WORD_RISK)) {
          if (word.length >= 5 && value.includes(word)) {
            consider(r, reason);
            break;
          }
        }
        continue;
      }
      if (row.operator === "intitle:" || row.operator === "allintitle:") {
        consider(TITLE_WORD_RISK[value], reason);
        continue;
      }
      if (row.operator === "") {
        consider(KEYWORD_RISK[value], reason);
        for (const [word, r] of Object.entries(KEYWORD_RISK)) {
          if (word.includes(" ") && value.includes(word)) {
            consider(r, reason);
            break;
          }
        }
      }
    }

    // Bare operator usage with a neutral value is still worth a baseline.
    if (op && op.value && op.kind !== "keyword" && level === "info") {
      if (op.kind === "filetype") consider("medium", `filetype:${raw}`);
    }
  }

  // Escalation: several medium/high rows compound into a worse finding.
  if (highCount >= 2) level = "critical";
  else if (mediumCount >= 3 && riskIndex(level) > riskIndex("critical")) {
    level = "high";
  }

  if (level === "info" && reasons.length === 0) {
    reasons.push("No sensitive operators or terms detected");
  }

  return { level, reasons: reasons.slice(0, 4) };
}

// --- Variations ---

const MAX_VARIATIONS = 500;

/** Total number of combinations across all list rows (capped for display). */
export function countVariations(rows: BuilderRow[]): number {
  let total = 1;
  for (const row of rows) {
    if (isListValue(row.value)) total *= listLength(row.value);
    if (total > MAX_VARIATIONS) return MAX_VARIATIONS;
  }
  return total;
}

/**
 * Generate every combination of list values across rows.
 * Non-list rows stay fixed. Returns at most MAX_VARIATIONS queries.
 */
export function generateVariations(rows: BuilderRow[]): string[] {
  const listIndices = rows
    .map((row, i) => (isListValue(row.value) ? i : -1))
    .filter((i) => i >= 0);

  if (listIndices.length === 0) {
    const q = buildQuery(rows);
    return q ? [q] : [];
  }

  const itemLists = listIndices.map((i) => splitList(rows[i].value));
  const results: string[] = [];

  const build = (depth: number, current: BuilderRow[]) => {
    if (depth === listIndices.length) {
      const q = buildQuery(current);
      if (q) results.push(q);
      return;
    }
    const rowIndex = listIndices[depth];
    for (const item of itemLists[depth]) {
      if (results.length >= MAX_VARIATIONS) return;
      const copy = current.map((r) => ({ ...r }));
      copy[rowIndex] = { ...copy[rowIndex], value: item };
      build(depth + 1, copy);
    }
  };

  build(0, rows);
  return results;
}
