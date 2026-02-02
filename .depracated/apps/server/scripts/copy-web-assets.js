import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
const webDistSource = join(serverRoot, "..", "web", "dist");
const webDistTarget = join(serverRoot, "web-dist");

if (!existsSync(webDistSource)) {
  console.log("Web dist not found at:", webDistSource);
  console.log("Skipping web assets copy. Run 'npm run build' in apps/web first.");
  process.exit(0);
}

if (existsSync(webDistTarget)) {
  rmSync(webDistTarget, { recursive: true });
}

mkdirSync(webDistTarget, { recursive: true });
cpSync(webDistSource, webDistTarget, { recursive: true });

console.log("Copied web assets to:", webDistTarget);
