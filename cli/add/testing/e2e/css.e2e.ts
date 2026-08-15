import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { manifestItem, readFixtureConfig, runDgadd, writeFixtureConfig } from "./test-helpers.js";

// Installing ui/dialog appends several chunks (its own backdrop rules plus the
// ones its transitive deps ship), so tests that target one chunk locate it by
// body text instead of taking whichever entry recorded chunks first.
const CSS_CHUNK_PATTERN =
  /\/\* dgadd:css ([a-f0-9]{16})(?: \S+)? \*\/([\s\S]*?)\/\* dgadd:css-end \1(?: \S+)? \*\//g;

function chunkHashContaining(css: string, declaration: string): string {
  for (const match of css.matchAll(CSS_CHUNK_PATTERN)) {
    const [, hash, body] = match;
    if (hash && body?.includes(declaration)) return hash;
  }
  throw new Error(`No dgadd CSS chunk contains ${declaration}.`);
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-cli-"));
  writeFixtureConfig(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("add command css", () => {
  test("add appends required component CSS to the configured Tailwind entry", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(
      join(root, "src/styles/styles.css"),
      [
        "/* Canonical style seed. Package builds and dgadd init append registry component CSS to this entry. */",
        '@import "./theme.css";',
        "",
      ].join("\n"),
    );

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const styles = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(styles).toMatch(/dialog::backdrop/);
    expect(existsSync(join(root, "src/components/ui/shared/dialog.css"))).toBe(false);
  });

  test("repeated add does not duplicate component CSS chunks even after whitespace edits", () => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), ['@import "./theme.css";', ""].join("\n"));

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);
    const afterFirst = readFileSync(join(root, "src/styles/styles.css"), "utf-8");

    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    const startCountFirst = (afterFirst.match(markerPattern) ?? []).length;
    expect(startCountFirst, "expected sentinel markers after first add").toBeGreaterThan(0);

    const perturbed = afterFirst
      .replace(/\n\n/g, "\n\n\n")
      .replace(/(dgadd:css [a-f0-9]{16}(?: \S+)? \*\/)/, "$1\n/* user comment */");
    writeFileSync(join(root, "src/styles/styles.css"), perturbed);

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);
    const afterSecond = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    const startCountSecond = (afterSecond.match(markerPattern) ?? []).length;

    expect(
      startCountSecond,
      "re-running add must not append duplicate chunks under whitespace/comment edits",
    ).toBe(startCountFirst);
    const sentinelEnds = (afterSecond.match(/\/\* dgadd:css-end [a-f0-9]{16}(?: \S+)? \*\//g) ?? [])
      .length;
    expect(sentinelEnds, "every chunk is bounded by matching markers").toBe(startCountSecond);
  });
});

describe("css ownership", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("add records css chunk ownership in the manifest", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifest = readFixtureConfig(root);
    const chunkOwner = Object.values(manifest.installedItems ?? {}).find(
      (entry) => (entry.cssChunks ?? []).length > 0,
    );
    expect(chunkOwner, "at least one item records cssChunks").toBeTruthy();
  });
});

describe("css chunk drift detection", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("clean install reports zero CSS chunk drift entries", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).not.toMatch(/styles\.css~chunk-/);
  });

  test("user edit inside a CSS chunk surfaces as drift", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const stylesContent = readFileSync(stylesPath, "utf-8");
    const perturbed = stylesContent.replace(/(dialog::backdrop)/, "/* user added comment */\n$1");
    expect(perturbed).not.toBe(stylesContent);
    writeFileSync(stylesPath, perturbed);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);
    expect(output).toMatch(/user added comment/);
    expect(output).toMatch(/Summary:.*changed/);
  });

  test("missing chunk in styles.css surfaces as drift", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const stylesContent = readFileSync(stylesPath, "utf-8");
    const chunkStripped = stylesContent.replace(
      /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\/[\s\S]*?\/\* dgadd:css-end [a-f0-9]{16}(?: \S+)? \*\/\n*/g,
      "",
    );
    expect(chunkStripped).not.toMatch(/dialog::backdrop/);
    writeFileSync(stylesPath, chunkStripped);

    const output = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(output).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);
    expect(output).toMatch(/dialog::backdrop/);
    expect(output).toMatch(/Summary:.*changed/);
  });

  test("add --overwrite repairs a diff-detected CSS chunk drift", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const original = readFileSync(stylesPath, "utf-8");

    // Edit inside the chunk body, marker hashes intact, so diff reports drift.
    const drifted = original.replace(/(dialog::backdrop)/, "/* user drift inside chunk */\n$1");
    expect(drifted).not.toBe(original);
    writeFileSync(stylesPath, drifted);

    const driftReport = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(driftReport).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);

    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install", "--overwrite"]);

    const repaired = readFileSync(stylesPath, "utf-8");
    expect(repaired).not.toMatch(/user drift inside chunk/);
    expect(repaired).toMatch(/dialog::backdrop/);
    expect(repaired).toMatch(/@import "\.\/theme\.css";/);

    const cleanReport = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(cleanReport).not.toMatch(/styles\.css~chunk-/);
  });
});

describe("css chunk ownership on remove", () => {
  beforeEach(() => {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  });

  test("shared chunk is preserved when one of two co-owners is removed", () => {
    runDgadd(["add", "ui/button", "--cwd", root, "--yes", "--skip-install"]);
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const manifest = readFixtureConfig(root);
    // Collect every recorded chunk so the assertions do not bind to the items
    // that happen to own the shared CSS today.
    const ownerHashes = [
      ...new Set(
        Object.values(manifest.installedItems ?? {}).flatMap((record) => record.cssChunks ?? []),
      ),
    ];
    expect(ownerHashes.length, "expected at least one item to record cssChunks").toBeGreaterThan(0);

    // Give ui/button (explicit, preserved) the same hashes: two items emitting
    // identical CSS, so every chunk must survive removal of a co-owner.
    const buttonItem = manifestItem(manifest, "ui/button");
    buttonItem.cssChunks = ownerHashes;
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(manifest, null, 2));

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    const cssAfter = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssAfter).toMatch(/dialog::backdrop/);
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(ownerHashes.length);

    const finalManifest = readFixtureConfig(root);
    expect(finalManifest.installedItems?.["ui/button"]).toBeTruthy();
  });

  test("unique chunks of a removed item are deleted from styles.css", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const cssBefore = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssBefore.match(markerPattern) ?? []).length).toBeGreaterThan(0);
    expect(cssBefore).toMatch(/dialog::backdrop/);

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"]);

    const cssAfter = readFileSync(join(root, "src/styles/styles.css"), "utf-8");
    expect(cssAfter).not.toMatch(/dialog::backdrop/);
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(0);
  });

  test("edited chunk is preserved on remove without --force and stays re-targetable", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    // Discover the owner of the chunk about to be edited so the assertions do
    // not bind to its name.
    const stylesPath = join(root, "src/styles/styles.css");
    const backdropHash = chunkHashContaining(readFileSync(stylesPath, "utf-8"), "dialog::backdrop");
    const beforeManifest = readFixtureConfig(root);
    const chunkOwnerEntry = Object.entries(beforeManifest.installedItems ?? {}).find(([, record]) =>
      (record.cssChunks ?? []).includes(backdropHash),
    );
    if (!chunkOwnerEntry) {
      throw new Error("Expected an item to own the dialog backdrop chunk.");
    }
    const [chunkOwner, ownerRecord] = chunkOwnerEntry;
    const ownerHashes = ownerRecord.cssChunks ?? [];

    const edited = readFileSync(stylesPath, "utf-8").replace(
      /(dialog::backdrop)/,
      "/* user tuned */\n$1",
    );
    writeFileSync(stylesPath, edited);

    const output = runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes"], { silent: false });
    expect(output).toMatch(/chunk has been modified \(use --force to override\)/);

    const cssAfter = readFileSync(stylesPath, "utf-8");
    expect(cssAfter).toMatch(/user tuned/);
    expect(cssAfter).toMatch(/dialog::backdrop/);

    // Retained owner stays tracked (trimmed to chunk tracking) so the block is
    // re-targetable by a later force remove instead of orphaned.
    const afterRemove = readFixtureConfig(root);
    const retained = afterRemove.installedItems?.[chunkOwner];
    expect(retained, `expected ${chunkOwner} to stay tracked for its preserved chunk`).toBeTruthy();
    if (!retained)
      throw new Error(`expected ${chunkOwner} to stay tracked for its preserved chunk`);
    expect(retained.cssChunks).toEqual(ownerHashes);
    expect(retained.files).toBeUndefined();

    const retainedDiff = runDgadd(["diff", "--cwd", root], { silent: false });
    expect(retainedDiff).toMatch(/styles\.css~chunk-[a-f0-9]{16}/);
    expect(retainedDiff).toMatch(/user tuned/);
    expect(retainedDiff).not.toMatch(/not installed/);

    runDgadd(["remove", chunkOwner, "--cwd", root, "--yes", "--force"]);

    const cssFinal = readFileSync(stylesPath, "utf-8");
    expect(cssFinal).not.toMatch(/user tuned/);
    expect(cssFinal).not.toMatch(/dialog::backdrop/);
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssFinal.match(markerPattern) ?? []).length).toBe(0);

    const finalManifest = readFixtureConfig(root);
    expect(finalManifest.installedItems?.[chunkOwner]).toBeUndefined();
  });

  test("edited chunk is removed on remove with --force", () => {
    runDgadd(["add", "ui/dialog", "--cwd", root, "--yes", "--skip-install"]);

    const stylesPath = join(root, "src/styles/styles.css");
    const edited = readFileSync(stylesPath, "utf-8").replace(
      /(dialog::backdrop)/,
      "/* user tuned */\n$1",
    );
    writeFileSync(stylesPath, edited);

    runDgadd(["remove", "ui/dialog", "--cwd", root, "--yes", "--force"]);

    const cssAfter = readFileSync(stylesPath, "utf-8");
    expect(cssAfter).not.toMatch(/user tuned/);
    expect(cssAfter).not.toMatch(/dialog::backdrop/);
    const markerPattern = /\/\* dgadd:css [a-f0-9]{16}(?: \S+)? \*\//g;
    expect((cssAfter.match(markerPattern) ?? []).length).toBe(0);
  });
});
