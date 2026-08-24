/**
 * Curated starting points for the Dork Builder. Each template is a set of
 * rows; lists (pipe-separated values) expand into variation combinations.
 */

import type { BuilderRow } from "./dork-builder";

export interface DorkTemplate {
  id: string;
  name: string;
  description: string;
  rows: Array<Omit<BuilderRow, "id">>;
}

export const DORK_TEMPLATES: DorkTemplate[] = [
  {
    id: "open-directories",
    name: "Open directories",
    description: "Directory listings with browsable file trees",
    rows: [
      { logic: "AND", operator: "intitle:", value: "index of" },
      { logic: "AND", operator: "intext:", value: "parent directory" },
    ],
  },
  {
    id: "exposed-config",
    name: "Exposed config files",
    description: "App/server config files that often hold secrets",
    rows: [
      { logic: "AND", operator: "filetype:", value: "env|ini|cfg|conf" },
      { logic: "AND", operator: "inurl:", value: "config" },
    ],
  },
  {
    id: "database-dumps",
    name: "Database dumps",
    description: "SQL dumps and database backups",
    rows: [
      { logic: "AND", operator: "filetype:", value: "sql" },
      { logic: "OR", operator: "intext:", value: "INSERT INTO" },
      { logic: "OR", operator: "intext:", value: "MySQL dump" },
    ],
  },
  {
    id: "env-secrets",
    name: ".env & secrets",
    description: "Environment files with API keys and credentials",
    rows: [
      { logic: "AND", operator: "inurl:", value: ".env" },
      { logic: "OR", operator: "filetype:", value: "env" },
      { logic: "AND", operator: "intext:", value: "DB_PASSWORD" },
    ],
  },
  {
    id: "git-exposure",
    name: "Exposed .git",
    description: "Public .git directories leaking source history",
    rows: [
      { logic: "AND", operator: "inurl:", value: ".git/config" },
      { logic: "OR", operator: "inurl:", value: ".git/HEAD" },
    ],
  },
  {
    id: "backup-files",
    name: "Backup archives",
    description: "Backup files that may contain full site copies",
    rows: [
      { logic: "AND", operator: "filetype:", value: "bak|old|backup" },
      { logic: "OR", operator: "filetype:", value: "zip|tar|gz|rar" },
      { logic: "AND", operator: "inurl:", value: "backup" },
    ],
  },
  {
    id: "admin-panels",
    name: "Admin / login panels",
    description: "Admin consoles and login pages",
    rows: [
      { logic: "AND", operator: "intitle:", value: "admin login" },
      { logic: "OR", operator: "inurl:", value: "admin" },
      { logic: "OR", operator: "inurl:", value: "login" },
    ],
  },
  {
    id: "wordpress-config",
    name: "WordPress configs",
    description: "wp-config.php files with DB credentials",
    rows: [
      { logic: "AND", operator: "inurl:", value: "wp-config.php" },
      { logic: "AND", operator: "filetype:", value: "php" },
      { logic: "AND", operator: "intext:", value: "DB_PASSWORD" },
    ],
  },
  {
    id: "phpinfo-pages",
    name: "phpinfo() pages",
    description: "Exposed phpinfo pages revealing server internals",
    rows: [
      { logic: "AND", operator: "intitle:", value: "phpinfo()" },
      { logic: "AND", operator: "intext:", value: "PHP Version" },
    ],
  },
  {
    id: "cloud-buckets",
    name: "Cloud storage buckets",
    description: "Open S3 / cloud storage buckets",
    rows: [
      { logic: "AND", operator: "site:", value: "s3.amazonaws.com" },
      { logic: "OR", operator: "site:", value: "storage.googleapis.com" },
      { logic: "AND", operator: "intext:", value: "bucket" },
    ],
  },
  {
    id: "spreadsheet-creds",
    name: "Credentials in spreadsheets",
    description: "Spreadsheets and CSVs containing password data",
    rows: [
      { logic: "AND", operator: "filetype:", value: "xls|xlsx|csv" },
      { logic: "AND", operator: "intext:", value: "password" },
    ],
  },
  {
    id: "camera-feeds",
    name: "Camera / IoT feeds",
    description: "Exposed webcams and network camera viewers",
    rows: [
      { logic: "AND", operator: "intitle:", value: "Live View / - AXIS" },
      { logic: "OR", operator: "inurl:", value: "viewerframe?mode=" },
      { logic: "OR", operator: "inurl:", value: "/view.shtml" },
    ],
  },
  {
    id: "government-recon",
    name: "Government recon",
    description: "Sensitive documents on government domains",
    rows: [
      { logic: "AND", operator: "site:", value: "*.gov|*.mil" },
      { logic: "AND", operator: "filetype:", value: "pdf" },
      { logic: "AND", operator: "intext:", value: "confidential" },
    ],
  },
  {
    id: "error-logs",
    name: "Error logs & stack traces",
    description: "Debug logs leaking paths and internals",
    rows: [
      { logic: "AND", operator: "filetype:", value: "log" },
      { logic: "OR", operator: "intext:", value: "stack trace" },
      { logic: "OR", operator: "intext:", value: "Fatal error" },
    ],
  },
  {
    id: "aws-keys",
    name: "AWS access keys",
    description: "Hard-coded AWS access key IDs in files",
    rows: [
      { logic: "AND", operator: "intext:", value: "AKIA" },
      { logic: "OR", operator: "intext:", value: "aws_secret_access_key" },
      { logic: "AND", operator: "filetype:", value: "txt|log|json" },
    ],
  },
];

export function getTemplate(id: string): DorkTemplate | undefined {
  return DORK_TEMPLATES.find((t) => t.id === id);
}
