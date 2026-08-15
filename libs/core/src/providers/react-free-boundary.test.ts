import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_PEERS = ["react", "react-dom", "react/jsx-runtime", "@tanstack/react-query"];
const SPECIFIER_PATTERN = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*"([^"]+)"/g;

function readSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(SPECIFIER_PATTERN)].map((match) => match[1] ?? "");
}

/** Walks the static import graph of an entry module, following relative edges only. */
function collectPeerImports(entry: string): Map<string, string[]> {
  const peerImports = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    for (const specifier of readSpecifiers(file)) {
      if (specifier.startsWith(".")) {
        queue.push(resolve(dirname(file), specifier.replace(/\.js$/, ".ts")));
        continue;
      }
      if (!UI_PEERS.includes(specifier)) continue;
      peerImports.set(file, [...(peerImports.get(file) ?? []), specifier]);
    }
  }

  return peerImports;
}

describe("@diffgazer/core/providers boundary", () => {
  // cli/server imports the pure product policy from this entry without declaring
  // React or TanStack Query, which are optional peers of @diffgazer/core.
  it("never reaches the optional React or TanStack Query peers", () => {
    const offenders = collectPeerImports(resolve(HERE, "index.ts"));

    expect([...offenders.keys()]).toEqual([]);
  });

  it("keeps the React hooks reachable from the dedicated hooks entry", () => {
    const offenders = collectPeerImports(resolve(HERE, "hooks.ts"));

    expect([...offenders.keys()].length).toBeGreaterThan(0);
  });
});
