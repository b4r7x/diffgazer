import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const clientOutputs = [
  "dist/index.js",
  "dist/providers/keyboard-provider.js",
  "dist/context/keyboard-context.js",
  "dist/hooks/use-focus-trap.js",
  "dist/hooks/use-focus-zone.js",
  "dist/hooks/use-key.js",
  "dist/hooks/use-navigation.js",
  "dist/hooks/use-scope.js",
  "dist/hooks/use-scoped-navigation.js",
  "dist/hooks/use-scroll-lock.js",
] as const;

const missing = clientOutputs.filter((relativePath) => {
  const path = resolve(ROOT, relativePath);
  if (!existsSync(path)) return true;
  const content = readFileSync(path, "utf-8").trimStart();
  return !content.startsWith('"use client";') && !content.startsWith('"use client"');
});

if (missing.length > 0) {
  throw new Error(
    `Missing "use client" directive in built @diffgazer/keys output:\n${missing
      .map((path) => `- ${path}`)
      .join("\n")}`,
  );
}

console.log("[keys] RSC client directives OK");
