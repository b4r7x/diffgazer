import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function resolveKeysRoot(startDir: string): string {
  const candidates = [
    resolve(startDir, "libs/keys"),
    resolve(startDir, "node_modules/@diffgazer/keys"),
    resolve(startDir, "../node_modules/@diffgazer/keys"),
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "registry/registry.json"))) {
      return candidate;
    }
  }

  throw new Error(
    [
      "Unable to find keys registry source.",
      "Looked in:",
      ...candidates.map((c) => `  - ${c}`),
      "Ensure the keys workspace checkout exists.",
    ].join("\n"),
  );
}
