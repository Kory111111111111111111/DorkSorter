/**
 * Turns a Google dork into one plain-language sentence for people who
 * don't read operators yet. Uses the builder's parser so aliases such as
 * ext: stay in sync with query editing.
 */

import { parseQuery, type BuilderRow } from "./dork-builder";

const FILE_NAMES: Record<string, string> = {
  env: "environment files",
  sql: "SQL files",
  pdf: "PDFs",
  bak: "backup files",
  log: "log files",
  conf: "config files",
  cfg: "config files",
  ini: "config files",
  pem: "private key files",
  key: "key files",
  csv: "spreadsheets",
  xls: "spreadsheets",
  xlsx: "spreadsheets",
  doc: "Word documents",
  docx: "Word documents",
  zip: "zip archives",
  tar: "archives",
  gz: "archives",
};

function filePhrase(ext: string): string {
  const name = ext.trim().replace(/^\./, "").toLowerCase();
  if (!name) return "files";
  if (FILE_NAMES[name]) return FILE_NAMES[name];
  if (name.length <= 4) return `${name.toUpperCase()} files`;
  return `${name} files`;
}

function show(value: string, limit = 48): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= limit) return cleaned;
  return `${cleaned.slice(0, limit - 1)}…`;
}

/** Keyword rows sometimes carry ext:/extension: that the parser leaves as text. */
function asFiletype(row: BuilderRow): string | null {
  if (row.operator === "filetype:") return row.value;
  if (row.operator !== "") return null;
  const alias = row.value.match(/^(?:ext|extension):(.+)$/i);
  return alias ? alias[1] : null;
}

function mention(value: string): string {
  return `that mention ${show(value)}`;
}

function modifier(row: BuilderRow): string | null {
  const value = row.value.trim();
  if (!value && row.operator !== "AROUND(n)") return null;

  switch (row.operator) {
    case "filetype:":
      return `that are ${filePhrase(value)}`;
    case "site:":
      return `on ${show(value)}`;
    case "inurl:":
    case "allinurl:":
      return `with ${show(value)} in the URL`;
    case "intitle:":
    case "allintitle:":
    case "inposttitle:":
      return `with ${show(value)} in the title`;
    case "intext:":
    case "allintext:":
    case "":
      return mention(value);
    case "inanchor:":
    case "allinanchor:":
      return `linked with the text ${show(value)}`;
    case "before:":
      return `indexed before ${show(value)}`;
    case "after:":
      return `indexed after ${show(value)}`;
    case "AROUND(n)":
      return `with those terms within ${value || "a few"} words`;
    case "cache:":
      return `from the cached copy of ${show(value)}`;
    case "related:":
      return `similar to ${show(value)}`;
    case "link:":
      return `that link to ${show(value)}`;
    case "define:":
      return `defining ${show(value)}`;
    default:
      return `matching ${row.operator}${show(value)}`;
  }
}

function exclusion(row: BuilderRow): string | null {
  if (row.operator === "site:") return `outside ${show(row.value)}`;
  const ext = asFiletype(row);
  if (ext) return `excluding ${filePhrase(ext)}`;
  if (!row.value.trim()) return null;
  return `excluding ${show(row.value)}`;
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function joinMentions(parts: string[]): string {
  const out: string[] = [];
  let pending: string[] = [];
  const flush = () => {
    if (pending.length === 0) return;
    out.push(`that mention ${joinAnd(pending)}`);
    pending = [];
  };
  for (const part of parts) {
    if (part.startsWith("that mention ")) pending.push(part.slice("that mention ".length));
    else {
      flush();
      out.push(part);
    }
  }
  flush();
  return out.join(" ");
}

function describeGroup(rows: BuilderRow[]): string {
  const included = rows.filter((row) => row.logic !== "NOT");
  const excluded = rows.filter((row) => row.logic === "NOT");

  let subject = "pages";
  const parts: string[] = [];

  for (const row of included) {
    const ext = asFiletype(row);
    if (ext && subject === "pages") {
      subject = filePhrase(ext);
      continue;
    }
    const text = modifier(row);
    if (text) parts.push(text);
  }

  for (const row of excluded) {
    const text = exclusion(row);
    if (text) parts.push(text);
  }

  const shown = parts.slice(0, 3);
  let sentence = `Finds ${subject}`;
  if (shown.length > 0) sentence += ` ${joinMentions(shown)}`;
  if (parts.length > shown.length) sentence += ", and more";
  return sentence;
}

function orGroups(rows: BuilderRow[]): BuilderRow[][] {
  const groups: BuilderRow[][] = [];
  let current: BuilderRow[] = [];
  for (const row of rows) {
    if (row.logic === "OR" && current.length > 0) {
      groups.push(current);
      current = [{ ...row, logic: "AND" }];
    } else {
      current.push(row);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** One sentence describing what a dork search is looking for. */
export function describeQuery(query: string): string {
  const rows = parseQuery(query).filter((row) => row.value.trim() || row.operator === "AROUND(n)");
  if (rows.length === 0) return "Finds pages matching this search.";

  const structured = rows.some((row) => row.operator !== "" || asFiletype(row) !== null);
  if (!structured) {
    return `Finds pages that mention ${show(query, 80)}.`;
  }

  const groups = orGroups(rows).slice(0, 2);
  const lead = describeGroup(groups[0]);
  if (groups.length === 1) return `${lead}.`;

  const alt = describeGroup(groups[1]).replace(/^Finds /, "");
  const extra = orGroups(rows).length > 2 ? ", or other combinations" : "";
  return `${lead}, or ${alt}${extra}.`;
}
