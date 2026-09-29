import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const source = path.join(process.cwd(), "src", "data", "dorks.json");
const destDir = path.join(process.cwd(), "public");
const dest = path.join(destDir, "dorks.json");

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
