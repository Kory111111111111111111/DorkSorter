/**
 * Ingestion script: reads Google dork lists from the local Proviesec corpus
 * and the cloned repos under sources/, drops case-insensitive duplicates,
 * and writes src/data/dorks.json.
 *
 * Usage: npx tsx scripts/ingest-dorks.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

const DORKS_DIR = process.env.DORKS_DIR ?? "C:/Users/koryi/Desktop/google-dorks";
const SOURCES_ROOT = path.join(process.cwd(), "sources");
const OUTPUT_DIR = path.join(process.cwd(), "src/data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "dorks.json");

/** Proviesec is scanned first so its categorized files win ties. */
const SOURCES: Array<{ id: string; root: string }> = [
  { id: "proviesec", root: DORKS_DIR },
  { id: "bullseye", root: path.join(SOURCES_ROOT, "bullseye") },
  { id: "tuxcmd", root: path.join(SOURCES_ROOT, "tuxcmd") },
  { id: "taksec", root: path.join(SOURCES_ROOT, "taksec") },
  { id: "sushi", root: path.join(SOURCES_ROOT, "sushi") },
  { id: "gdorks", root: path.join(SOURCES_ROOT, "gdorks") },
  { id: "ghdb", root: path.join(SOURCES_ROOT, "ghdb") },
];

const SKIP_DIRS = new Set([
  ".git",
  ".github",
  "node_modules",
  "img",
  "tools",
  // Bulk generated dump, not a curated list.
  "Dorks(1M)",
  // Account-list dump, not search queries.
  "Netflix",
  // Mixed folder of carding, shopping, and gaming lists.
  "google-dork",
]);

/** Filename denylist: fraud, piracy, and IP-targeted generated dumps. */
const SKIP_FILE =
  /carding|amazon|shoping|shopping|gaming|minecraft|netflix|fortnite|bitcoin|\bbtc\b|credit-card|ip\+dorks|cdiso|^movies$|^games$|^commons$/i;

// --- Types ---

interface RawDork {
  query: string;
  sourceFile: string;
  sourceCategory: string;   // derived from file path
  sourceTag?: string;       // derived from section header inside file
  lineNumber: number;
}

interface NormalizedDork {
  id: string;
  query: string;
  category: string;
  subcategory: string;
  tags: string[];
  sourceFile: string;
  riskLevel: "critical" | "high" | "medium" | "low" | "info";
}

// --- Helpers ---

function capitalizeWords(text: string): string {
  return text
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Parse filename into a human-readable category */
function filenameToCategory(filePath: string): string {
  const base = path.basename(filePath, path.extname(filePath));
  const stripped = base.replace(/_/g, "-").replace(/\s+/g, "-");
  const name =
    stripped
      .replace(/^google-dorks?-/, "")
      .replace(/^best-/, "")
      .replace(/^all-/, "") || "google-dorks";

  // Known mappings
  const mappings: Record<string, string> = {
    "for-sql-injection": "SQL Injection",
    "for-xss": "XSS / Injection",
    "for-open-redirect": "Open Redirect",
    "for-webserver": "Web Server",
    "for-login": "Login / Auth",
    "for-backups": "Backups",
    "for-bug-bounty-programs": "Bug Bounty",
    "for-openai": "AI / OpenAI",
    "for-anthropic": "AI / Anthropic",
    "for-cohere": "AI / Cohere",
    "for-azure": "Cloud / Azure",
    "for-gcp": "Cloud / GCP",
    "for-aws": "Cloud / AWS",
    "for-aws-passwords": "Credential Leaks",
    "for-mysql-passwords": "Credential Leaks",
    "for-postgres-passwords": "Credential Leaks",
    "for-cloud-platforms": "Cloud",
    "for-ci-cd": "CI/CD",
    "for-companys": "Company Recon",
    "for-conf": "Config Files",
    "for-database-files": "Database Files",
    "for-discord": "Chat / Discord",
    "for-env-files": "Environment Files",
    "for-excel-files": "Excel Files",
    "for-firebase": "Firebase",
    "for-frameworks": "Frameworks",
    "for-ftp": "FTP",
    "for-git-files": "Git / Source Leaks",
    "for-github-actions": "CI/CD",
    "for-grafana": "Monitoring / Grafana",
    "for-js-secrets": "Secrets / JS",
    "for-kibana": "Monitoring / Kibana",
    "for-kubernetes": "Kubernetes",
    "for-mailgun": "Email / Mailgun",
    "for-mongodb": "MongoDB",
    "for-monitoring": "Monitoring",
    "for-presentations": "Documents",
    "for-sendgrid": "Email / SendGrid",
    "for-slack": "Chat / Slack",
    "for-stats": "Statistics",
    "for-stripe": "Payment / Stripe",
    "for-swagger": "API / Swagger",
    "for-twilio": "Comms / Twilio",
    "for-wikipedia": "Wikipedia",
    "for-finding-aws-s3": "S3 Buckets",
    "for-php-sites": "PHP Sites",
    "for-java-sites": "Java Sites",
    "for-jira": "Jira",
    "best": "Best Dorks",
    "best-log": "Log Dorks",
    "dorks-all": "All Dorks",
    "dorks-best": "Best Dorks",
    "dorks-best-log": "Log Dorks",
    "for-wordpress": "CMS / WordPress",
    "for-drupal": "CMS / Drupal",
    "for-joomla": "CMS / Joomla",
    "for-typo3": "CMS / Typo3",
    "for-blogengine": "CMS / BlogEngine",
    "magento": "CMS / Magento",
    "contao": "CMS / Contao",
    "for-apache": "Web Server / Apache",
    "for-nginx": "Web Server / Nginx",
    "for-phpmyadmin": "Web Server / phpMyAdmin",
    "best-webserver": "Web Server",
    "admindorks-full": "Login / Admin Panels",
    "googledorks-full": "Google Dorks",
    sqli: "SQL Injection",
    sqli1: "SQL Injection",
    xss: "XSS / Injection",
    lfi: "LFI",
    rfi: "RFI",
    cctv: "Cameras",
  };

  if (mappings[name]) return mappings[name];

  // Try to match "for-<something>"
  const match = name.match(/^for-(.+)$/);
  if (match) return capitalizeWords(match[1]);

  return capitalizeWords(name);
}

const DIR_CATEGORY: Record<string, string> = {
  cms: "CMS",
  "finding-username-passwords": "Credential Leaks",
  technology: "Technology Recon",
  "web-server": "Web Server",
  sqli: "SQL Injection",
  xss: "XSS / Injection",
  wordpress: "CMS / WordPress",
  joomla: "CMS / Joomla",
  laravel: "Frameworks",
  lfi: "LFI",
  rfi: "RFI",
  cctv: "Cameras",
};

/** Nearest topic folder wins over a generic filename like 1.txt. */
function categoryFromPath(root: string, fullPath: string): string {
  const rel = path.relative(root, fullPath);
  const parts = rel.split(path.sep);
  parts.pop();
  for (let i = parts.length - 1; i >= 0; i--) {
    const mapped = DIR_CATEGORY[parts[i].toLowerCase()];
    if (mapped) return mapped;
  }
  return filenameToCategory(fullPath);
}

function subcategoryFromPath(root: string, fullPath: string): string | undefined {
  const parts = path.relative(root, fullPath).split(path.sep);
  parts.pop();
  const parent = parts[parts.length - 1];
  if (!parent) return undefined;
  const key = parent.toLowerCase();
  // Numbered dumps and raw GHDB list files are not a useful subcategory.
  if (key === "more-dorks" || key === "lists") return undefined;
  return parent;
}

const GHDB_CATEGORY: Record<string, string> = {
  "Files Containing Juicy Info": "Documents",
  "Files Containing Passwords": "Credential Leaks",
  "Files Containing Usernames": "Credential Leaks",
  "Sensitive Directories": "Directory Listing",
  "Error Messages": "Error Logs & Debug",
  "Pages Containing Login Portals": "Login / Admin Panels",
  "Vulnerable Servers": "Web Server",
  "Web Server Detection": "Web Server Recon",
  "Advisories and Vulnerabilities": "Advisories",
  "Various Online Devices": "Cameras",
  "Network or Vulnerability Data": "Network Devices",
  "Vulnerable Files": "Vulnerable Files",
  "Sensitive Online Shopping Info": "Shopping Data",
  Footholds: "Footholds",
};

const DORK_OPERATOR =
  /\b(allinurl|allintitle|allintext|allinanchor|inurl|intitle|intext|inanchor|filetype|ext|site|cache|link|related|info|define|before|after|source|location)\s*:/i;

function cleanQuery(line: string): string {
  return line
    .trim()
    .replace(/^\d+\.\s+/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop banners, prose, bare URLs, and carding lines. Keep real search queries. */
function looksLikeDork(line: string): boolean {
  const s = line.trim();
  if (s.length < 2 || s.length > 1500) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/\[.*?\]\(https?:/i.test(s) || /\*\*/.test(s)) return false;
  if (/carding|\bcvv\b|\bfullz\b/i.test(s)) return false;

  let nonAscii = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 126) nonAscii++;
  }
  if (nonAscii > s.length * 0.15) return false;

  if (DORK_OPERATOR.test(s)) return true;
  if (/"[^"]+"/.test(s)) return true;
  if (/\?\w*=/.test(s)) return true;
  if (/\.(php\d?|asp|aspx|jsp|html?|cfm|cgi|txt|sql|env|bak|conf|ini|log|xml|json|pwd)\b/i.test(s))
    return true;
  if (/^(admin|login|wp-admin|phpmyadmin)/i.test(s)) return true;

  const words = s.split(/\s+/);
  if (
    words.length <= 6 &&
    !/[.!?]$/.test(s) &&
    !/[:*]{3,}/.test(s) &&
    /^[\w\s.'"\-/:+|&]+$/.test(s)
  ) {
    return true;
  }
  return false;
}

function decodeHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function toSourceFile(sourceId: string, root: string, fullPath: string): string {
  return `${sourceId}/${path.relative(root, fullPath).split(path.sep).join("/")}`;
}

// --- AI keyword auto-tagging for unknown dorks ---

const TAG_RULES: Array<{ tag: string; patterns: RegExp[] }> = [
  {
    tag: "env-files",
    patterns: [/\.env/i, /filetype:env/i, /inurl:\.env/i],
  },
  {
    tag: "sql-dump",
    patterns: [
      /filetype:sql/i,
      /mysql.?dump/i,
      /inurl:dump\.sql/i,
      /inurl:database\.sql/i,
    ],
  },
  {
    tag: "backup",
    patterns: [
      /inurl:backup/i,
      /filetype:zip backup/i,
      /filetype:tar/i,
      /filetype:gz backup/i,
      /\.bak\b/i,
    ],
  },
  {
    tag: "config",
    patterns: [
      /inurl:config/i,
      /inurl:wp-config/i,
      /inurl:settings\.php/i,
      /inurl:\.cfg/i,
      /inurl:\.ini/i,
    ],
  },
  {
    tag: "credentials",
    patterns: [
      /password/i,
      /passwd/i,
      /secret.?key/i,
      /BEGIN RSA PRIVATE KEY/i,
      /access_key/i,
      /SECRET_ACCESS_KEY/i,
      /authorization:/i,
    ],
  },
  {
    tag: "directory-listing",
    patterns: [
      /intitle:index of/i,
      /intitle:"index of"/i,
      /Parent Directory/i,
    ],
  },
  {
    tag: "login-panel",
    patterns: [
      /inurl:login/i,
      /inurl:signin/i,
      /inurl:auth/i,
      /intitle:admin login/i,
      /inurl:wp-admin/i,
    ],
  },
  {
    tag: "api",
    patterns: [
      /inurl:swagger/i,
      /inurl:openapi/i,
      /inurl:api-docs/i,
      /inurl:\/graphql/i,
      /graphiql/i,
      /inurl:rest/i,
    ],
  },
  {
    tag: "error-log",
    patterns: [
      /filetype:log/i,
      /inurl:error\.log/i,
      /inurl:debug\.log/i,
      /stack trace/i,
      /fatal error/i,
      /exception/i,
    ],
  },
  {
    tag: "php",
    patterns: [
      /filetype:php/i,
      /phpinfo/i,
      /"PHP Credits"/i,
      /"Powered by.*php/i,
    ],
  },
  {
    tag: "sql-injection",
    patterns: [
      /\?id=/i,
      /\?page=/i,
      /\?pid=/i,
      /\?cat=/i,
      /\?product/i,
      /\?action=/i,
      /\?search=/i,
      /\?\w+=/,
    ],
  },
  {
    tag: "xss",
    patterns: [
      /inurl:&.*inurl:/i,
      /inurl:search.*inurl:query/i,
    ],
  },
  {
    tag: "git",
    patterns: [
      /inurl:\.git/i,
      /\.git\/config/i,
      /\.git\/HEAD/i,
    ],
  },
  {
    tag: "cloud",
    patterns: [
      /s3\.amazonaws\.com/i,
      /storage\.googleapis\.com/i,
      /aws/i,
      /gcp/i,
      /azure/i,
      /firebase/i,
      /cloud/i,
    ],
  },
  {
    tag: "ci-cd",
    patterns: [
      /jenkins/i,
      /gitlab/i,
      /github actions/i,
      /pipeline/i,
      /docker/i,
      /kubernetes/i,
      /kube/i,
    ],
  },
  {
    tag: "ftp",
    patterns: [
      /inurl:ftp/i,
      /ftp:/i,
    ],
  },
  {
    tag: "webserver",
    patterns: [
      /apache/i,
      /nginx/i,
      /iis/i,
      /liteSpeed/i,
      /tomcat/i,
      /Server at/i,
      /"Server at"/i,
      /intitle:"Test Page for Apache"/i,
      /CERN httpd/i,
      /Microsoft-IIS/i,
      /JRun Web Server/i,
      /"server at" intitle:index/i,
    ],
  },
  {
    tag: "passwords",
    patterns: [
      /ext:pwd/i,
      /enc_UserPassword/i,
      /enc_GroupPwd/i,
      /inurl:passwd/i,
      /filetype:xls.*password/i,
      /filetype:csv.*password/i,
    ],
  },
  {
    tag: "source-leaks",
    patterns: [
      /inurl:\.svn/i,
      /inurl:\.hg/i,
      /inurl:\.DS_Store/i,
      /desktop\.ini/i,
      /filetype:map "webpack/i,
    ],
  },
  {
    tag: "cms",
    patterns: [
      /WordPress/i,
      /wp-content/i,
      /wp-admin/i,
      /Drupal/i,
      /Joomla/i,
      /Magento/i,
      /Typo3/i,
      /phpMyAdmin/i,
      /vBulletin/i,
      /Powered by.*CMS/i,
      /SugarCRM/i,
      /inurl:typo3/i,
    ],
  },
  {
    tag: "database",
    patterns: [
      /mysql/i,
      /postgres/i,
      /mongodb/i,
      /oracle/i,
      /sqlserver/i,
      /"Microsoft SQL Server"/i,
      /phpMyAdmin.*dump/i,
      /"Table structure"/i,
    ],
  },
  {
    tag: "editors",
    patterns: [
      /win-merge.*ext:ini/i,
      /PuTTY/i,
      /[Tt]era.?[Tt]erm/i,
      /filetype:reg/i,
      /[Ff]fftp/i,
      /mirc/i,
      /"[boot loader]"/i,
    ],
  },
  {
    tag: "security-tools",
    patterns: [
      /arachni/i,
      /burpsuite/i,
      /nessus/i,
      /nmap/i,
      /metasploit/i,
      /openvas/i,
    ],
  },
  {
    tag: "email",
    patterns: [
      /mailman/i,
      /squirrelmail/i,
      /roundcube/i,
      /horde/i,
      /webmail/i,
      /owa/i,
    ],
  },
  {
    tag: "network-devices",
    patterns: [
      /router/i,
      /firewall/i,
      /switch/i,
      /cpe/i,
      /gateway/i,
      /vpn/i,
      /snmp/i,
      /netgear/i,
      /cisco/i,
      /sonicwall/i,
      /juniper/i,
    ],
  },
  {
    tag: "web-paths",
    patterns: [
      /inurl:\.asp/i,
      /inurl:\.aspx/i,
      /inurl:\.jsp/i,
      /inurl:\.cgi/i,
      /inurl:\.cfm/i,
      /inurl:\.pl\b/i,
      /inurl:\.py\b/i,
    ],
  },
  {
    tag: "tech-stack",
    patterns: [
      /"Powered by\s/i,
      /powered by/i,
      /"Copyright\s/i,
      /all rights reserved/i,
      /"created by/i,
      /intitle:"Test Page/i,
      /splash.?page/i,
      /Served by/i,
      /"Generated by/i,
      /"200[0-9]\s/i,
      /"201[0-9]\s/i,
      /Version \d/i,
      /v\d\.\d/i,
      /"Copyright.*20[0-9][0-9]"/i,
    ],
  },
  {
    tag: "malware",
    patterns: [
      /stealer/i,
      /malware/i,
      /trojan/i,
      /ransomware/i,
      /botnet/i,
      /cryptominer/i,
      /coinhive/i,
      /web.?shell/i,
      /backdoor/i,
    ],
  },
];

function autoTag(query: string): string[] {
  const tags: string[] = [];
  for (const rule of TAG_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(query)) {
        tags.push(rule.tag);
        break;
      }
    }
  }
  return tags;
}

// --- Risk level heuristic ---

function assessRiskLevel(query: string, tags: string[]): NormalizedDork["riskLevel"] {
  const criticalTags = ["credentials", "env-files", "sql-dump", "git"];
  const highTags = [
    "api",
    "config",
    "login-panel",
    "backup",
    "error-log",
    "ci-cd",
  ];
  const mediumTags = [
    "directory-listing",
    "sql-injection",
    "xss",
    "cloud",
    "ftp",
  ];
  const lowTags = ["webserver", "php"];

  for (const t of criticalTags) if (tags.includes(t)) return "critical";
  for (const t of highTags) if (tags.includes(t)) return "high";
  for (const t of mediumTags) if (tags.includes(t)) return "medium";
  for (const t of lowTags) if (tags.includes(t)) return "low";

  // Check for key patterns directly
  if (/password|secret|BEGIN.*PRIVATE KEY|access_key|\.env/i.test(query))
    return "critical";
  if (/inurl:login|inurl:admin|inurl:config|\.sql\b|\.bak\b/i.test(query))
    return "high";
  if (/inurl:&|intitle:index of|\?id=|\?page=/i.test(query)) return "medium";

  return "info";
}

// --- Main ---

function shouldSkipFile(fileName: string): boolean {
  const base = path.basename(fileName, path.extname(fileName));
  if (SKIP_FILE.test(fileName) || SKIP_FILE.test(base)) return true;
  const lower = base.toLowerCase();
  return lower === "license" || lower === "contributing" || lower === "contact" || lower === "faq";
}

function pushDork(
  results: RawDork[],
  query: string,
  sourceFile: string,
  sourceCategory: string,
  sourceTag: string | undefined,
  lineNumber: number,
  strict: boolean,
) {
  const cleaned = cleanQuery(query);
  if (!cleaned) return;
  if (/carding|\bcvv\b|\bfullz\b/i.test(cleaned)) return;
  if (strict && !looksLikeDork(cleaned)) return;
  if (!strict && cleaned.length < 2) return;
  results.push({
    query: cleaned,
    sourceFile,
    sourceCategory,
    sourceTag,
    lineNumber,
  });
}

function parseTextLines(
  content: string,
  sourceFile: string,
  sourceCategory: string,
  subCategory: string | undefined,
  strict: boolean,
): RawDork[] {
  const results: RawDork[] = [];
  const lines = content.split(/\r?\n/);
  let currentSectionTag: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    if (raw.startsWith("# ")) {
      const sectionName = raw
        .replace(/^#+\s*/, "")
        .replace(/\s*\(.*?\)\s*$/, "")
        .trim()
        .toLowerCase();
      currentSectionTag = sectionName.split(/\s*\/\s*/)[0];
      continue;
    }
    if (/^=+$/.test(raw) || /^-{3,}$/.test(raw)) continue;
    pushDork(
      results,
      raw,
      sourceFile,
      sourceCategory,
      currentSectionTag ?? subCategory,
      i + 1,
      strict,
    );
  }
  return results;
}

function parseMarkdownFences(content: string, sourceFile: string): RawDork[] {
  const results: RawDork[] = [];
  const lines = content.split(/\r?\n/);
  let heading = "Bug Bounty";
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const headingMatch = raw.match(/^#{2,3}\s+(.*)/);
    if (headingMatch && !inFence) {
      heading = headingMatch[1].replace(/<!--.*?-->/g, "").trim();
      continue;
    }
    if (raw.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) continue;
    pushDork(results, raw, sourceFile, "Bug Bounty", heading, i + 1, true);
  }
  return results;
}

function parseGhdbCheatsheet(content: string, sourceFile: string): RawDork[] {
  const rows = JSON.parse(content) as Array<{
    url_title?: string;
    category?: { cat_title?: string };
  }>;
  const results: RawDork[] = [];
  for (let i = 0; i < rows.length; i++) {
    const title = rows[i].category?.cat_title ?? "GHDB";
    const category = GHDB_CATEGORY[title] ?? title;
    pushDork(results, decodeHtml(rows[i].url_title ?? ""), sourceFile, category, title, i + 1, true);
  }
  return results;
}

function collectFromRoot(sourceId: string, root: string): RawDork[] {
  const results: RawDork[] = [];
  const strict = sourceId !== "proviesec";

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
        continue;
      }
      if (shouldSkipFile(entry.name)) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const sourceFile = toSourceFile(sourceId, root, fullPath);
      const isTaksecReadme = sourceId === "taksec" && entry.name.toLowerCase() === "readme.md";
      const isGhdbCheatsheet = sourceId === "ghdb" && entry.name === "cheatsheet";
      const isList = ext === ".txt" || ext === ".dorks" || (ext === "" && sourceId === "ghdb");

      if (!isTaksecReadme && !isGhdbCheatsheet && !isList) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      if (isTaksecReadme) {
        results.push(...parseMarkdownFences(content, sourceFile));
        continue;
      }
      if (isGhdbCheatsheet) {
        results.push(...parseGhdbCheatsheet(content, sourceFile));
        continue;
      }

      let category = categoryFromPath(root, fullPath);
      if (
        (sourceId === "sushi" || sourceId === "taksec") &&
        GENERIC_CATEGORIES.has(category)
      ) {
        category = "Bug Bounty";
      }
      results.push(
        ...parseTextLines(
          content,
          sourceFile,
          category,
          subcategoryFromPath(root, fullPath),
          strict,
        ),
      );
    }
  }

  walk(root);
  return results;
}

function collectAllDorks(): RawDork[] {
  const results: RawDork[] = [];
  for (const source of SOURCES) {
    if (!fs.existsSync(source.root)) {
      console.log(`   skip ${source.id}: ${source.root} not found`);
      continue;
    }
    const found = collectFromRoot(source.id, source.root);
    console.log(`   ${source.id}: ${found.length} lines`);
    for (const row of found) results.push(row);
  }
  return results;
}

/** Deterministic id so regenerating the corpus never churns record ids. */
function dorkId(query: string): string {
  return createHash("sha1").update(query).digest("hex").slice(0, 10);
}

// Generic category names that should be re-assigned via auto-tagging
const GENERIC_CATEGORIES = new Set([
  "Google Dorks",
  "Googledorks Full",
  "All Dorks",
  "Best Dorks",
  "Log Dorks",
  "Log",
  "Dorks",
  "Dorks2",
  "Dorks3",
  "Dorks 2023",
]);

// Map auto-tag to human-readable category name
const TAG_TO_CATEGORY: Record<string, string> = {
  "sql-dump": "SQL Dumps & Databases",
  "sql-injection": "SQL Injection",
  "xss": "XSS / Injection",
  "env-files": "Environment Files",
  "credentials": "Credential Leaks",
  "passwords": "Credential Leaks",
  "backup": "Backups",
  "config": "Config Files",
  "directory-listing": "Directory Listing",
  "login-panel": "Login / Admin Panels",
  "api": "API / Swagger",
  "error-log": "Error Logs & Debug",
  "git": "Git / Source Leaks",
  "source-leaks": "Git / Source Leaks",
  "cloud": "Cloud Platforms",
  "ci-cd": "CI/CD & DevOps",
  "ftp": "FTP",
  "webserver": "Web Server Recon",
  "php": "PHP Sites",
  "cms": "CMS",
  "database": "SQL Dumps & Databases",
  "editors": "Editor & App Configs",
  "security-tools": "Security Tools",
  "email": "Email Systems",
  "network-devices": "Network Devices",
  "web-paths": "Web Paths",
  "tech-stack": "Technology Fingerprints",
  "malware": "Malware / Threats",
};

interface StoredDork extends NormalizedDork {
  spec: number;
}

/**
 * 0 = catch-all dump, 1 = uncategorized list, 2 = a topic file.
 * A higher score replaces a lower one. Equal scores keep the first seen,
 * and Proviesec is scanned first.
 */
function sourceSpecificity(sourceFile: string): number {
  const normalized = sourceFile.toLowerCase().replace(/\\/g, "/");
  const base = path
    .basename(normalized)
    .replace(/\.[^.]+$/, "")
    .replace(/_/g, "-")
    .trim();
  // Official GHDB category is attached per row.
  if (base === "cheatsheet") return 3;
  // Curated bug-bounty lists, not bulk dumps.
  if (normalized.startsWith("sushi/") || normalized.startsWith("taksec/")) return 3;
  if (normalized.includes("/more-dorks/")) return 1;
  // Catch-all dumps lose to a topic file and to the GHDB.
  if (base.includes("all-google-dorks") || base === "allgoogledorks") return 0;
  if (
    /^(dorks\d*|dorks-2023|dorks4-category|google-dorks|googledorks-full|googledorks|google|allintext|allintitle|allinurl|server|department|exploit-db|publiccctv|7k.*|10k.*|13k.*|best\d.*|mix\d*|vuln\d*|rfi\d*|admin2|files|sensitive\d*)$/.test(
      base,
    )
  ) {
    return 1;
  }
  return 3;
}

function normalize(raw: RawDork[]): { dorks: NormalizedDork[]; duplicates: number } {
  const seen = new Map<string, StoredDork>();
  let duplicates = 0;

  for (const dork of raw) {
    const normalized = cleanQuery(dork.query);
    if (!normalized || normalized.length < 3) continue;

    // Google searches are case-insensitive, so article.php?ID= and
    // article.php?id= are the same dork and only one is kept.
    const key = normalized.toLowerCase();
    const spec = sourceSpecificity(dork.sourceFile);

    if (seen.has(key)) {
      const existing = seen.get(key)!;
      if (spec <= existing.spec) {
        duplicates++;
        continue;
      }
      seen.delete(key);
      duplicates++;
    }

    const tags = autoTag(normalized);
    const riskLevel = assessRiskLevel(normalized, tags);

    // Dump files are named after the list, not the topic. Recategorize those
    // from the query. Topic files and GHDB rows keep their own category.
    let category = dork.sourceCategory;
    if (spec <= 1 || GENERIC_CATEGORIES.has(category)) {
      if (tags.length > 0) {
        const primaryTag = tags[0];
        category = TAG_TO_CATEGORY[primaryTag] || capitalizeWords(primaryTag.replace(/-/g, " "));
      } else if (spec <= 1) {
        category = "General";
      }
    }

    // Build subcategory
    let subcategory = dork.sourceTag || "";
    if (!subcategory) {
      if (tags.length > 1) subcategory = capitalizeWords(tags[1].replace(/-/g, " "));
      else if (tags.length > 0) subcategory = capitalizeWords(tags[0].replace(/-/g, " "));
      else subcategory = "Uncategorized";
    } else {
      subcategory = capitalizeWords(subcategory);
    }

    seen.set(key, {
      id: dorkId(normalized),
      query: normalized,
      category,
      subcategory,
      tags: [...new Set(tags)],
      sourceFile: dork.sourceFile,
      riskLevel,
      spec,
    });
  }

  const dorks = Array.from(seen.values()).map((stored) => ({
    id: stored.id,
    query: stored.query,
    category: stored.category,
    subcategory: stored.subcategory,
    tags: stored.tags,
    sourceFile: stored.sourceFile,
    riskLevel: stored.riskLevel,
  }));
  return { dorks, duplicates };
}

// --- Execute ---

console.log("Scanning dork sources");
const raw = collectAllDorks();
console.log(`   Found ${raw.length} raw dork lines`);

const { dorks: normalized, duplicates } = normalize(raw);
console.log(`   Duplicates removed: ${duplicates}`);
console.log(`   After dedup: ${normalized.length} unique dorks`);

const seenKeys = new Set<string>();
for (const dork of normalized) {
  const key = dork.query.toLowerCase();
  if (seenKeys.has(key)) {
    throw new Error(`Duplicate query survived dedup: ${dork.query}`);
  }
  seenKeys.add(key);
}

// Stats
const catCounts: Record<string, number> = {};
const riskCounts: Record<string, number> = {};
for (const d of normalized) {
  catCounts[d.category] = (catCounts[d.category] || 0) + 1;
  riskCounts[d.riskLevel] = (riskCounts[d.riskLevel] || 0) + 1;
}
console.log("\nCategories:");
for (const [cat, n] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   ${cat}: ${n}`);
}
console.log("\nRisk levels:");
for (const [r, n] of Object.entries(riskCounts)) {
  console.log(`   ${r}: ${n}`);
}

// Write output
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ dorks: normalized }, null, 2));
console.log(`\n✅ Written to ${OUTPUT_FILE}`);
console.log(`   Size: ${(fs.statSync(OUTPUT_FILE).size / 1024).toFixed(0)} KB`);