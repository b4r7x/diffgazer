import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The figlet wordmark ships from three places that cannot import from each other:
 * apps/web hardcodes it (keeping figlet out of the browser bundle), apps/docs
 * generates it at prepare time, and apps/landing inlines it as markup in a page with
 * no framework. Keeping the art identical is a hand-sync contract, and it has already
 * drifted visibly more than once, so this guard reads all three as text — no
 * cross-package import, no build step — and compares bytes.
 *
 * cli/diffgazer is deliberately absent: it renders the art with figlet at runtime, so
 * apps/web holds the only hand-written copy.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const WEB_WORDMARK = "apps/web/src/components/layout/wordmark.tsx";
const DOCS_GENERATED = "apps/docs/src/generated/logo-ascii.ts";
const LANDING_PAGE = "apps/landing/index.html";

/** One `<span class="fl">` line wrapper of the landing hero's figlet block. */
const LANDING_ROW = /<span class="fl"><span>([\s\S]*?)<\/span><\/span>/g;

function read(relativePath, remedy = "") {
  const absolute = resolve(REPO_ROOT, relativePath);
  assert.ok(existsSync(absolute), `${relativePath} is missing.${remedy}`);
  return readFileSync(absolute, "utf-8");
}

function extractWebRows() {
  const source = read(WEB_WORDMARK);
  const literal = source.match(/const WORDMARK_ASCII = \[([\s\S]*?)\]\.join\("\\n"\);/);
  assert.ok(
    literal,
    `${WEB_WORDMARK}: no \`const WORDMARK_ASCII = [...].join("\\n")\` array literal. The wordmark parity guard reads this file as text; update the guard alongside the refactor.`,
  );
  const rows = literal[1].match(/"(?:[^"\\]|\\.)*"/g);
  assert.ok(rows, `${WEB_WORDMARK}: WORDMARK_ASCII holds no string rows.`);
  return rows.map((row) => JSON.parse(row));
}

function extractDocsConstant(name) {
  const source = read(
    DOCS_GENERATED,
    " Run `pnpm run prepare:artifacts` to generate the docs wordmark before this check.",
  );
  const declaration = source.match(new RegExp(`export const ${name} = (.+);`));
  assert.ok(declaration, `${DOCS_GENERATED}: no \`export const ${name}\`.`);
  return JSON.parse(declaration[1]);
}

function extractLandingBlock(pattern, label) {
  const html = read(LANDING_PAGE);
  const block = html.match(pattern);
  assert.ok(block, `${LANDING_PAGE}: no ${label} block.`);
  return block[1];
}

function extractLandingHeroRows() {
  const block = extractLandingBlock(/<pre id="figlet"[^>]*>([\s\S]*?)<\/pre>/, "#figlet");
  assert.ok(
    !/&[a-zA-Z#][a-zA-Z0-9]*;/.test(block),
    `${LANDING_PAGE}: the figlet block contains an HTML entity, so its rows can no longer be compared as raw text.`,
  );
  const rows = [...block.matchAll(LANDING_ROW)].map((row) => row[1]);
  assert.ok(rows.length > 0, `${LANDING_PAGE}: the figlet block has no \`span.fl\` rows.`);
  assert.equal(
    block.replaceAll(LANDING_ROW, ""),
    "",
    `${LANDING_PAGE}: the figlet block holds markup outside its \`span.fl\` rows, which this guard would not compare.`,
  );
  return rows;
}

test("the docs wordmark is generated from the art apps/web hardcodes", () => {
  assert.equal(
    extractDocsConstant("WORDMARK_ASCII"),
    extractWebRows().join("\n"),
    `${DOCS_GENERATED} and ${WEB_WORDMARK} disagree. Both render the same brand mark; re-sync the figlet font, casing, and trailing-blank-row trim.`,
  );
});

test("the docs grid constants describe the art the docs ship", () => {
  const rows = extractDocsConstant("WORDMARK_ASCII").split("\n");
  assert.equal(extractDocsConstant("WORDMARK_ROWS"), rows.length);
  assert.equal(extractDocsConstant("WORDMARK_COLS"), Math.max(...rows.map((row) => row.length)));
});

test("the landing hero inlines the same art, row for row", () => {
  assert.deepEqual(
    extractLandingHeroRows(),
    extractWebRows(),
    `${LANDING_PAGE} and ${WEB_WORDMARK} disagree. The hero art is inlined by hand; copy the rows across including their trailing padding.`,
  );
});

test("the landing HUD mark is the same art with its trailing padding trimmed", () => {
  // The corner HUD paints the art at a few pixels tall behind `aria-hidden`, where the
  // padding columns are dead weight, so it is the one copy allowed to differ — and
  // only by that. Everything else about it still has to match.
  const hud = extractLandingBlock(
    /<pre class="logo-figlet"[^>]*>([\s\S]*?)<\/pre>/,
    "`pre.logo-figlet` HUD",
  ).split("\n");
  assert.deepEqual(
    hud,
    extractWebRows().map((row) => row.trimEnd()),
    `${LANDING_PAGE}: the HUD mark drifted from the hero art beyond its trailing padding.`,
  );
});
