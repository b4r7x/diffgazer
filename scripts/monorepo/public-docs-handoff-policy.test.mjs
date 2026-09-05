import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { test } from "node:test";
import { listFilesByExtension } from "./lib/files.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

function readRepoFile(path) {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function listDocsFiles(dir, extension) {
  return listFilesByExtension(resolve(REPO_ROOT, dir), extension);
}

function collectPublicDocsSources() {
  const files = [
    ...listDocsFiles("libs/ui/registry/component-docs", ".ts"),
    ...listDocsFiles("libs/ui/docs/content", ".mdx"),
    ...listDocsFiles("libs/ui/docs/generated", ".json"),
    ...listDocsFiles("libs/keys/docs/hook-docs", ".ts"),
    ...listDocsFiles("libs/keys/docs/content", ".mdx"),
    ...listDocsFiles("libs/keys/docs/generated", ".json"),
    ...listDocsFiles("libs/keys/docs/generated", ".ts"),
  ];

  return files.map((file) => ({
    path: relative(REPO_ROOT, file),
    source: readFileSync(file, "utf8"),
  }));
}

function collectInputLikeDocsSources() {
  const paths = [
    "libs/ui/registry/component-docs/input.ts",
    "libs/ui/registry/component-docs/textarea.ts",
    "libs/ui/registry/component-docs/search-input.ts",
    "libs/ui/docs/content/components/input.mdx",
    "libs/ui/docs/content/components/textarea.mdx",
    "libs/ui/docs/content/components/search-input.mdx",
    "libs/ui/docs/generated/components/input.json",
    "libs/ui/docs/generated/components/textarea.json",
    "libs/ui/docs/generated/components/search-input.json",
  ];

  return paths.map((path) => ({ path, source: readRepoFile(path) }));
}

function camelToKebab(value) {
  return value.replace(
    /[A-Z]/g,
    (match, index) => `${index === 0 ? "" : "-"}${match.toLowerCase()}`,
  );
}

test("public docs handoff uses the exact React peer floor", () => {
  const docs = [
    readRepoFile("libs/ui/README.md"),
    readRepoFile("libs/keys/README.md"),
    readRepoFile("cli/add/README.md"),
    readRepoFile("PACKAGE_GOVERNANCE.md"),
    readRepoFile("libs/ui/docs/content/getting-started/typescript.mdx"),
    readRepoFile("libs/ui/docs/content/getting-started/consumption-modes.mdx"),
    readRepoFile("libs/keys/docs/content/getting-started/index.mdx"),
    readRepoFile("libs/keys/docs/content/api/index.mdx"),
  ].join("\n");

  assert.match(docs, /React `>=19\.2\.0`/);
  assert.doesNotMatch(docs, /React 19(?!\.2|`)/);
  assert.doesNotMatch(docs, /React 19\+|React 19\.2\+/);
});

test("public install snippets stay local-first or publish-gated", () => {
  const docs = [
    "libs/ui/README.md",
    "libs/keys/README.md",
    "cli/add/README.md",
    "cli/diffgazer/README.md",
    ...listDocsFiles("libs/ui/docs/content", ".mdx").map((file) => relative(REPO_ROOT, file)),
    ...listDocsFiles("libs/keys/docs/content", ".mdx").map((file) => relative(REPO_ROOT, file)),
    ...listDocsFiles("apps/docs/content/docs/app/cli", ".mdx").map((file) =>
      relative(REPO_ROOT, file),
    ),
  ];
  const installCommand =
    /npx @diffgazer\/add|pnpm dlx @diffgazer\/add|yarn dlx @diffgazer\/add|bunx @diffgazer\/add|npm install @diffgazer\/|npm install -g diffgazer|pnpm exec dgadd/;
  const publishGate =
    /not yet published to npm|first release|local checkout|npm view|publish-gated|After Publication|after publication|after `@diffgazer\/add` is published|after its npm package is published/;

  for (const path of docs) {
    const source = readRepoFile(path);
    if (!installCommand.test(source)) continue;

    if (path === "cli/diffgazer/README.md") {
      assert.match(source, /`diffgazer` is live on npm/);
      continue;
    }

    assert.match(source, publishGate, path);
  }
});

test("governance records the registry live-check disposition", () => {
  const governance = readRepoFile("PACKAGE_GOVERNANCE.md");

  assert.match(
    governance,
    /\*\*skips\*\* while that flag is `true` and `DIFFGAZER_LIVE_REGISTRY_REQUIRED` is unset/i,
  );
  assert.match(governance, /DNS resolution and `HEAD` reachability/i);
  assert.match(governance, /does \*\*not\*\* compare hosted bytes/i);
  assert.match(governance, /DIFFGAZER_LIVE_REGISTRY_REQUIRED=1/);
  assert.match(governance, /raw response bytes to match the committed file exactly/i);
});

test("public READMEs show the consumption path matrix", () => {
  const rootReadme = readRepoFile("README.md");
  const uiReadme = readRepoFile("libs/ui/README.md");
  const keysReadme = readRepoFile("libs/keys/README.md");
  const cliReadme = readRepoFile("cli/add/README.md");

  for (const readme of [rootReadme, uiReadme, keysReadme]) {
    assert.match(readme, /Manual copy/);
    assert.match(readme, /dgadd/);
    assert.match(readme, /npm package/);
  }
  assert.match(cliReadme, /@diffgazer\/ui/);
  assert.match(cliReadme, /@diffgazer\/keys/);

  for (const readme of [rootReadme, uiReadme, keysReadme, cliReadme]) {
    assert.match(readme, /publish-gated|not yet published to npm/);
  }
});

test("exported keys hooks have matching handoff pages", () => {
  const indexSource = readRepoFile("libs/keys/src/index.ts");
  const utilitiesPage = readRepoFile("libs/keys/docs/content/api/utilities.mdx");
  const documentedOnUtilitiesPage = ["useKeyboardContext", "useOptionalKeyboardContext"];

  for (const hook of documentedOnUtilitiesPage) {
    assert.match(utilitiesPage, new RegExp(`\\b${hook}\\b`), hook);
  }

  const exportedHookSlugs = [...indexSource.matchAll(/export \{([^}]*)\} from "/g)]
    .flatMap((match) => (match[1] ?? "").split(","))
    .map((name) => name.trim())
    .filter((name) => /^use[A-Z]/.test(name) && !documentedOnUtilitiesPage.includes(name))
    .map(camelToKebab)
    .sort();
  const documentedHookSlugs = listDocsFiles("libs/keys/docs/content/hooks", ".mdx")
    .map((file) =>
      relative(REPO_ROOT, file)
        .replace(/\.mdx$/, "")
        .split("/")
        .at(-1),
    )
    .filter((slug) => slug && slug !== "index")
    .sort();

  assert.deepEqual(documentedHookSlugs, exportedHookSlugs);
});

test("public docs stay off removed API aliases", () => {
  const globalForbidden = [/\bonValueChange\b/, /\bonSelectedIdChange\b/, /\bhighlightedId\b/];
  const checkboxRadioForbidden = [/\bonCheckedChange\b/];

  for (const { path, source } of collectPublicDocsSources()) {
    for (const pattern of globalForbidden) assert.doesNotMatch(source, pattern, path);
    if (/\b(checkbox|radio)\b/i.test(path) && !/\bmenu\b/i.test(path)) {
      for (const pattern of checkboxRadioForbidden) assert.doesNotMatch(source, pattern, path);
    }
  }
});

test("input-like public docs use aria-invalid for invalid state", () => {
  const forbidden = [
    /\berror=\{?true\}?/,
    /\berror prop\b/i,
    /\bpass error\b/i,
    /\bsetting error\b/i,
  ];
  const sources = collectInputLikeDocsSources();

  for (const { path, source } of sources) {
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, path);
  }
  assert.match(sources.map(({ source }) => source).join("\n"), /aria-invalid/);
});

test("public docs use current highlight and keyboard prop names", () => {
  const docs = [
    readRepoFile("libs/ui/registry/component-docs/menu.ts"),
    readRepoFile("libs/ui/registry/component-docs/navigation-list.ts"),
    readRepoFile("libs/ui/registry/component-docs/select.ts"),
    readRepoFile("libs/ui/registry/component-docs/checkbox.ts"),
    readRepoFile("libs/ui/docs/content/patterns/keyboard-navigation.mdx"),
    readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
    readRepoFile("libs/ui/docs/content/components/checkbox.mdx"),
    readRepoFile("libs/ui/docs/content/components/select.mdx"),
  ].join("\n");

  assert.doesNotMatch(docs, /\bNavigationList\b[\s\S]{0,160}\bisHighlighted\b/);
  assert.doesNotMatch(docs, /isFocused/);
  assert.doesNotMatch(docs, /onHighlight props/);
  assert.doesNotMatch(docs, /headless (focus|keyboard)/);
  assert.doesNotMatch(docs, /highlightedId/);
  assert.match(docs, /highlighted/);
  assert.match(docs, /onHighlightChange/);
  assert.match(docs, /focused/);
  assert.match(docs, /built-in arrow navigation/);
});

test("public composition docs do not promise opaque wrapper depth", () => {
  const docs = [
    readRepoFile("libs/ui/docs/content/patterns/compound-components.mdx"),
    ...listDocsFiles("libs/ui/registry/component-docs", ".ts").map((file) =>
      readFileSync(file, "utf8"),
    ),
  ].join("\n");

  assert.doesNotMatch(docs, /no matter how deep|arbitrarily nested|deeply nested/i);
  assert.match(docs, /opaque wrapper/);
  assert.match(docs, /direct StepperContent child/);
});
