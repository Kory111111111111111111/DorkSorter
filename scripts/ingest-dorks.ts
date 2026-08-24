/**
 * Ingestion script: reads all Google dork .txt files from the source directory,
 * deduplicates, auto-categorizes, and outputs a normalized JSON dataset.
 *
 * Usage: npx tsx scripts/ingest-dorks.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";

const DORKS_DIR = process.env.DORKS_DIR ?? "C:/Users/koryi/Desktop/google-dorks";
const OUTPUT_DIR = path.join(process.cwd(), "src/data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "dorks.json");

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
  const base = path.basename(filePath, ".txt");
  const name = base
    .replace(/^google-dorks?-/, "")
    .replace(/^best-/, "")
    .replace(/^all-/, "");

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
  };

  if (mappings[name]) return mappings[name];

  // Try to match "for-<something>"
  const match = name.match(/^for-(.+)$/);
  if (match) return capitalizeWords(match[1]);

  return capitalizeWords(name);
}

/** Get subcategory from directory structure */
function dirToSubcategory(dirPath: string): string | null {
  const parts = dirPath.replace(DORKS_DIR + "/", "").split("/");
  if (parts.length === 1) return null; // root-level file
  const subdir = parts[0];
  const mappings: Record<string, string> = {
    cms: "CMS",
    "finding-username-passwords": "Credential Leaks",
    technology: "Technology Recon",
    "web-server": "Web Server",
  };
  return mappings[subdir] || capitalizeWords(subdir);
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

function collectAllDorks(dirPath: string): RawDork[] {
  const results: RawDork[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== ".git" && entry.name !== ".github") {
          walk(fullPath);
        }
      } else if (entry.name.endsWith(".txt")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split(/\r?\n/);
        const sourceCategory = filenameToCategory(fullPath);
        const subCategory = dirToSubcategory(fullPath);
        let currentSectionTag: string | null = null;

        for (let i = 0; i < lines.length; i++) {
          const raw = lines[i].trim();

          // Skip empty lines
          if (!raw) continue;

          // Detect section headers
          if (raw.startsWith("# ")) {
            const sectionName = raw.replace(/^#+\s*/, "").replace(/\s*\(.*?\)\s*$/, "").trim().toLowerCase();
            currentSectionTag = sectionName.split(/\s*\/\s*/)[0];
            continue;
          }
          if (/^=+$/.test(raw)) continue; // skip divider lines used in some files

          results.push({
            query: raw,
            sourceFile: path.relative(DORKS_DIR, fullPath),
            sourceCategory,
            sourceTag: currentSectionTag ?? subCategory ?? undefined,
            lineNumber: i + 1,
          });
        }
      }
    }
  }

  walk(dirPath);
  return results;
}

/** Deterministic id so regenerating the corpus never churns record ids. */
function dorkId(query: string): string {
  return createHash("sha1").update(query).digest("hex").slice(0, 10);
}

// Generic category names that should be re-assigned via auto-tagging
const GENERIC_CATEGORIES = new Set([
  "Google Dorks",
  "All Dorks",
  "Best Dorks",
  "Log Dorks",
  "Log",
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

function normalize(raw: RawDork[]): NormalizedDork[] {
  const seen = new Map<string, NormalizedDork>();

  for (const dork of raw) {
    // Normalize whitespace but keep the query intact
    const normalized = dork.query.replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length < 3) continue;

    // Dedupe on a case-insensitive key: Google searches are case-insensitive,
    // so "article.php?ID=" and "article.php?id=" are the same dork.
    const key = normalized.toLowerCase();

    // Dedupe: a dork from a specific source file always beats the same query
    // from the generic all-google-dorks.txt, regardless of traversal order.
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      const existingGeneric = existing.sourceFile.includes("all-google-dorks.txt");
      const newGeneric = dork.sourceFile.includes("all-google-dorks.txt");
      if (newGeneric && !existingGeneric) continue; // existing is more specific
      if (!newGeneric && existingGeneric) {
        seen.delete(key); // new is more specific — replace below
      } else {
        continue; // same specificity, keep first
      }
    }

    const tags = autoTag(normalized);
    const riskLevel = assessRiskLevel(normalized, tags);

    // Determine category: use source file category unless it's generic
    let category = dork.sourceCategory;
    if (GENERIC_CATEGORIES.has(category) && tags.length > 0) {
      const primaryTag = tags[0];
      category = TAG_TO_CATEGORY[primaryTag] || capitalizeWords(primaryTag.replace(/-/g, " "));
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
      tags: [...new Set(tags)], // dedupe tags
      sourceFile: dork.sourceFile,
      riskLevel,
    });
  }

  return Array.from(seen.values());
}

// --- Execute ---

console.log("🔍 Scanning dork files from:", DORKS_DIR);
const raw = collectAllDorks(DORKS_DIR);
console.log(`   Found ${raw.length} raw dork lines`);

const normalized = normalize(raw);
console.log(`   After dedup: ${normalized.length} unique dorks`);

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