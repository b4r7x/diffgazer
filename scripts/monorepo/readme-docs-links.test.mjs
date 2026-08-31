import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { listRepoFiles } from "./lib/files.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const DOCS_CONTENT_ROOT = resolve(REPO_ROOT, "apps/docs/content/docs");

// READMEs ship inside published packages, so a dead docs link lands on the npm
// landing page where no route test or docs build would ever notice it.
function listReadmes() {
  return listRepoFiles(REPO_ROOT).filter((repoPath) => repoPath.endsWith("README.md"));
}

function readPublicOrigin() {
  const source = readFileSync(resolve(REPO_ROOT, "apps/docs/src/lib/public-origin.ts"), "utf8");
  const match = source.match(/DEFAULT_PUBLIC_ORIGIN = "([^"]+)"/);
  assert.ok(match, "apps/docs/src/lib/public-origin.ts must export DEFAULT_PUBLIC_ORIGIN");
  return match[1];
}

function findUrls(source, pattern) {
  return (source.match(pattern) ?? []).map((url) => url.replace(/[.,;:)\]]+$/, ""));
}

test("shipped READMEs link the documentation site by its real origin", () => {
  const publicOrigin = readPublicOrigin();

  for (const repoPath of listReadmes()) {
    const source = readFileSync(resolve(REPO_ROOT, repoPath), "utf8");
    const docsHostUrls = findUrls(source, /https:\/\/[a-z0-9-]*docs[a-z0-9.-]*\/[^\s)"'`<>]*/gi);

    for (const url of docsHostUrls) {
      assert.ok(
        url.startsWith(`${publicOrigin}/`),
        `${repoPath} links ${url}, but the documentation site is served from ${publicOrigin}`,
      );
    }
  }
});

test("shipped README documentation links resolve to docs content", () => {
  const publicOrigin = readPublicOrigin();
  const originPattern = new RegExp(`${publicOrigin}/[^\\s)"'\`<>]*`, "g");

  for (const repoPath of listReadmes()) {
    const source = readFileSync(resolve(REPO_ROOT, repoPath), "utf8");

    for (const url of findUrls(source, originPattern)) {
      const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
      const candidates = [
        resolve(DOCS_CONTENT_ROOT, `${path}.mdx`),
        resolve(DOCS_CONTENT_ROOT, path, "index.mdx"),
      ];
      assert.ok(
        candidates.some((candidate) => existsSync(candidate)),
        `${repoPath} links ${url}, which has no page under apps/docs/content/docs/${path}`,
      );
    }
  }
});
