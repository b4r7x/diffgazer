import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The CWE-150 terminal-escape sanitizer ships from two places that cannot import from each
 * other: libs/core devDepends on @diffgazer/registry for its dist ESM build check, so the
 * reverse edge would make the package graph cyclic under turbo's `^build`. Keeping the
 * escape grammar identical is therefore a hand-sync contract, and a security fix landed on
 * one copy alone is exactly the failure this guard exists to catch. It reads both as text —
 * no cross-package import, no build step — and compares every declaration they share.
 *
 * Core additionally exports structural-control helpers the registry copy has no use for;
 * those may stay core-only. Everything the registry copy declares has to match core.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const CORE_SANITIZER = "libs/core/src/sanitize-terminal.ts";
const REGISTRY_SANITIZER = "libs/registry/src/cli/sanitize-terminal.ts";

/** The escape grammar itself, so an emptied or renamed copy cannot pass vacuously. */
const SHARED_DECLARATIONS = [
  "ESC",
  "BEL",
  "C1_ST",
  "CSI_FINAL_MIN",
  "CSI_FINAL_MAX",
  "isCsiSequenceByte",
  "consumeCsi",
  "consumeOsc",
  "isStrippedControl",
  "UNICODE_BIDI_FORMATTING_CONTROLS",
  "isUnicodeBidiFormattingControl",
  "escapeBidiFormattingControl",
  "sanitizeTerminalText",
];

/** Both copies are flat: every declaration starts at column zero. */
const DECLARATION = /^(?:export )?(?:const|function) ([A-Za-z0-9_]+)/gm;

function read(relativePath) {
  const absolute = resolve(REPO_ROOT, relativePath);
  assert.ok(existsSync(absolute), `${relativePath} is missing.`);
  return readFileSync(absolute, "utf-8");
}

/** Comments and formatting are allowed to differ; only the code has to match. */
function normalize(declaration) {
  return declaration
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/\/\/[^\n]*/g, "")
    .replace(/^export /, "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function declarationsOf(relativePath) {
  const source = read(relativePath);
  const starts = [...source.matchAll(DECLARATION)];
  assert.ok(
    starts.length > 0,
    `${relativePath}: no top-level declarations. This guard reads the file as text; update it alongside the refactor.`,
  );
  return new Map(
    starts.map((start, index) => {
      const end = starts[index + 1]?.index ?? source.length;
      return [start[1], normalize(source.slice(start.index, end))];
    }),
  );
}

test("both sanitizer copies still declare the whole escape grammar", () => {
  const core = declarationsOf(CORE_SANITIZER);
  const registry = declarationsOf(REGISTRY_SANITIZER);

  for (const name of SHARED_DECLARATIONS) {
    assert.ok(core.has(name), `${CORE_SANITIZER}: \`${name}\` is gone.`);
    assert.ok(registry.has(name), `${REGISTRY_SANITIZER}: \`${name}\` is gone.`);
  }
});

test("the registry copy declares nothing core lacks, and every shared body matches", () => {
  const core = declarationsOf(CORE_SANITIZER);

  for (const [name, body] of declarationsOf(REGISTRY_SANITIZER)) {
    assert.ok(
      core.has(name),
      `${REGISTRY_SANITIZER}: \`${name}\` has no counterpart in ${CORE_SANITIZER}. The registry copy mirrors core; add it there too.`,
    );
    assert.equal(
      body,
      core.get(name),
      `\`${name}\` differs between ${CORE_SANITIZER} and ${REGISTRY_SANITIZER}. These copies strip terminal escapes (CWE-150); apply the change to both.`,
    );
  }
});

test("each sanitizer copy names the other as its mirror", () => {
  assert.match(
    read(CORE_SANITIZER),
    new RegExp(REGISTRY_SANITIZER),
    `${CORE_SANITIZER} must name ${REGISTRY_SANITIZER} as its mirror, or the duplication reads as accidental.`,
  );
  assert.match(
    read(REGISTRY_SANITIZER),
    new RegExp(CORE_SANITIZER),
    `${REGISTRY_SANITIZER} must name ${CORE_SANITIZER} as its mirror, or the duplication reads as accidental.`,
  );
});
