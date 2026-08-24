/**
 * Comprehensive library of Google search operators for the Dork Builder.
 *
 * This is the single source of truth for which operators exist, how they are
 * rendered, which corpus suggestions feed their value inputs, and which ones
 * Google has discontinued (kept for legacy engines and documentation value).
 */

export type OperatorKind =
  | "keyword"
  | "site"
  | "url"
  | "title"
  | "text"
  | "anchor"
  | "filetype"
  | "link"
  | "date"
  | "proximity"
  | "other";

/** Corpus suggestion buckets served by /api/dorks/suggestions. */
export type SuggestionBucket =
  | "filetype"
  | "site"
  | "inurl"
  | "intitle"
  | "intext"
  | "inanchor";

export interface DorkOperator {
  /** Canonical value, e.g. "site:". Empty string means plain keyword. */
  value: string;
  /** Short label shown in the operator picker. */
  label: string;
  /** Human-readable name. */
  name: string;
  kind: OperatorKind;
  description: string;
  /** Placeholder for the value input. */
  placeholder: string;
  example: string;
  deprecated?: boolean;
  /** Which corpus suggestion bucket feeds this operator's value input. */
  suggestions?: SuggestionBucket;
}

export const KEYWORD_OPERATOR: DorkOperator = {
  value: "",
  label: "Keyword",
  name: "Keyword / phrase",
  kind: "keyword",
  description:
    "A plain search term or quoted phrase. Multiple words are treated as a phrase when quoted.",
  placeholder: 'e.g. password, "index of", phpinfo',
  example: '"index of"',
};

export const OPERATORS: DorkOperator[] = [
  KEYWORD_OPERATOR,
  {
    value: "site:",
    label: "site:",
    name: "Restrict to a domain",
    kind: "site",
    description:
      "Restrict results to a single domain or subdomain. Wildcards like *.gov are allowed.",
    placeholder: "e.g. example.com, *.gov",
    example: "site:example.com",
    suggestions: "site",
  },
  {
    value: "inurl:",
    label: "inurl:",
    name: "Term in URL",
    kind: "url",
    description: "Finds pages whose URL contains the given term.",
    placeholder: "e.g. admin, login, .env, ?id=",
    example: "inurl:admin",
    suggestions: "inurl",
  },
  {
    value: "allinurl:",
    label: "allinurl:",
    name: "All terms in URL",
    kind: "url",
    description: "Finds pages whose URL contains all of the given terms.",
    placeholder: "e.g. admin login",
    example: "allinurl:admin login",
    suggestions: "inurl",
  },
  {
    value: "intitle:",
    label: "intitle:",
    name: "Term in title",
    kind: "title",
    description: "Finds pages whose <title> tag contains the given term.",
    placeholder: 'e.g. login, "index of", "Test Page for Apache"',
    example: 'intitle:"index of"',
    suggestions: "intitle",
  },
  {
    value: "allintitle:",
    label: "allintitle:",
    name: "All terms in title",
    kind: "title",
    description: "Finds pages whose <title> tag contains all of the given terms.",
    placeholder: "e.g. admin login",
    example: "allintitle:admin login",
    suggestions: "intitle",
  },
  {
    value: "intext:",
    label: "intext:",
    name: "Term in body text",
    kind: "text",
    description: "Finds pages whose visible body text contains the given term.",
    placeholder: 'e.g. password, "INSERT INTO"',
    example: 'intext:"INSERT INTO"',
    suggestions: "intext",
  },
  {
    value: "allintext:",
    label: "allintext:",
    name: "All terms in body text",
    kind: "text",
    description: "Finds pages whose visible body text contains all given terms.",
    placeholder: "e.g. password username",
    example: "allintext:password username",
    suggestions: "intext",
  },
  {
    value: "inanchor:",
    label: "inanchor:",
    name: "Term in anchor text",
    kind: "anchor",
    description: "Finds pages that are linked to with the given anchor text.",
    placeholder: "e.g. click here",
    example: "inanchor:login",
    suggestions: "inanchor",
  },
  {
    value: "allinanchor:",
    label: "allinanchor:",
    name: "All terms in anchor text",
    kind: "anchor",
    description: "Finds pages linked to with all of the given anchor terms.",
    placeholder: "e.g. admin login",
    example: "allinanchor:admin login",
    suggestions: "inanchor",
  },
  {
    value: "filetype:",
    label: "filetype:",
    name: "File extension",
    kind: "filetype",
    description:
      "Restricts results to a file type by extension. ext: is a synonym.",
    placeholder: "e.g. sql, pdf, php, env, bak, xls",
    example: "filetype:sql",
    suggestions: "filetype",
  },
  {
    value: "AROUND(n)",
    label: "AROUND(n)",
    name: "Proximity search",
    kind: "proximity",
    description:
      "Requires the previous and next terms to appear within n words of each other. Place it between two rows.",
    placeholder: "distance, e.g. 3",
    example: '"password" AROUND(3) "username"',
  },
  {
    value: "after:",
    label: "after:",
    name: "Results after a date",
    kind: "date",
    description: "Restricts results to pages indexed after the given date.",
    placeholder: "e.g. 2020, 2023-01-01",
    example: "after:2020",
  },
  {
    value: "before:",
    label: "before:",
    name: "Results before a date",
    kind: "date",
    description: "Restricts results to pages indexed before the given date.",
    placeholder: "e.g. 2022, 2023-12-31",
    example: "before:2022",
  },
  {
    value: "daterange:",
    label: "daterange:",
    name: "Julian date range",
    kind: "date",
    deprecated: true,
    description:
      "Legacy operator that filtered by a Julian-date range. Mostly broken on modern Google.",
    placeholder: "e.g. 2458125-2458200",
    example: "daterange:2458125-2458200",
  },
  {
    value: "cache:",
    label: "cache:",
    name: "Cached snapshot",
    kind: "link",
    deprecated: true,
    description:
      "Showed Google's cached copy of a URL. Effectively discontinued — Google removed the cached view.",
    placeholder: "e.g. example.com/page",
    example: "cache:example.com",
  },
  {
    value: "link:",
    label: "link:",
    name: "Pages linking to URL",
    kind: "link",
    deprecated: true,
    description:
      "Listed pages linking to a URL. Discontinued by Google years ago.",
    placeholder: "e.g. example.com",
    example: "link:example.com",
  },
  {
    value: "related:",
    label: "related:",
    name: "Similar pages",
    kind: "link",
    deprecated: true,
    description: "Found pages similar to a URL. Discontinued by Google.",
    placeholder: "e.g. example.com",
    example: "related:example.com",
  },
  {
    value: "info:",
    label: "info:",
    name: "Info about URL",
    kind: "link",
    deprecated: true,
    description: "Showed information about a URL. Discontinued by Google.",
    placeholder: "e.g. example.com",
    example: "info:example.com",
  },
  {
    value: "author:",
    label: "author:",
    name: "Article / post author",
    kind: "other",
    deprecated: true,
    description:
      "Found results by a specific author (Google Groups era). Largely defunct.",
    placeholder: "e.g. john",
    example: "author:john",
  },
  {
    value: "define:",
    label: "define:",
    name: "Definition",
    kind: "other",
    description: "Shows the dictionary definition of a term.",
    placeholder: "e.g. heuristic",
    example: "define:heuristic",
  },
  {
    value: "stocks:",
    label: "stocks:",
    name: "Stock information",
    kind: "other",
    description: "Shows stock information for a ticker symbol.",
    placeholder: "e.g. AAPL",
    example: "stocks:aapl",
  },
  {
    value: "weather:",
    label: "weather:",
    name: "Weather",
    kind: "other",
    description: "Shows weather for a location.",
    placeholder: "e.g. london",
    example: "weather:london",
  },
  {
    value: "loc:",
    label: "loc:",
    name: "Location filter",
    kind: "other",
    deprecated: true,
    description: "Filtered results by geographic location. Discontinued.",
    placeholder: "e.g. london",
    example: "loc:london",
  },
  {
    value: "phonebook:",
    label: "phonebook:",
    name: "Phone book lookup",
    kind: "other",
    deprecated: true,
    description: "Looked up residential phone listings. Discontinued.",
    placeholder: "e.g. 555-1234",
    example: "phonebook:5551234",
  },
  {
    value: "numrange:",
    label: "numrange:",
    name: "Numeric range",
    kind: "other",
    deprecated: true,
    description: "Filtered results within a numeric range. Discontinued.",
    placeholder: "e.g. 1000-2000",
    example: "numrange:1000-2000",
  },
  {
    value: "inposttitle:",
    label: "inposttitle:",
    name: "Term in post title",
    kind: "title",
    deprecated: true,
    description:
      "Searched blog post titles (Blogger era). Discontinued.",
    placeholder: "e.g. update",
    example: "inposttitle:update",
  },
  {
    value: "inpostauthor:",
    label: "inpostauthor:",
    name: "Post author",
    kind: "anchor",
    deprecated: true,
    description:
      "Searched blog post authors (Blogger era). Discontinued.",
    placeholder: "e.g. admin",
    example: "inpostauthor:admin",
  },
];

export interface OperatorGroup {
  label: string;
  operators: DorkOperator[];
}

export const OPERATOR_GROUPS: OperatorGroup[] = [
  { label: "Search terms", operators: [KEYWORD_OPERATOR] },
  {
    label: "Site & URL",
    operators: OPERATORS.filter((o) => o.kind === "site" || o.kind === "url"),
  },
  {
    label: "Titles & text",
    operators: OPERATORS.filter((o) => o.kind === "title" || o.kind === "text" || o.kind === "anchor"),
  },
  {
    label: "File types",
    operators: OPERATORS.filter((o) => o.kind === "filetype"),
  },
  {
    label: "Proximity & dates",
    operators: OPERATORS.filter((o) => o.kind === "proximity" || o.kind === "date"),
  },
  {
    label: "Other",
    operators: OPERATORS.filter((o) => o.kind === "other"),
  },
  {
    label: "Discontinued",
    operators: OPERATORS.filter((o) => o.deprecated && o.kind === "link"),
  },
];

/** Map of canonical operator value → operator (lowercased keys). */
export const OPERATOR_MAP: Record<string, DorkOperator> = Object.fromEntries(
  OPERATORS.map((op) => [op.value.toLowerCase(), op])
);

/** Aliases: non-canonical spellings that parse to a canonical operator. */
const OPERATOR_ALIASES: Record<string, string> = {
  "ext:": "filetype:",
};

/**
 * Normalize a raw operator token (e.g. "EXT", "ext:", " filetype ") to its
 * canonical value, or null when it isn't a known operator.
 */
export function normalizeOperator(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const withColon = trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
  const canonical = OPERATOR_ALIASES[withColon] ?? withColon;
  return canonical in OPERATOR_MAP ? OPERATOR_MAP[canonical].value : null;
}

/** Whether a token is a boolean keyword Google understands (OR/AND). */
export function isBooleanToken(token: string): "OR" | "AND" | null {
  if (token === "OR") return "OR";
  if (token === "AND") return "AND";
  return null;
}
