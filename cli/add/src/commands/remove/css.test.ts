import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { type DiffgazerAddConfig, DiffgazerAddConfigSchema } from "../../context.js";
import { editChunkBody, seedChunk, styledConfig } from "../../testing/css-fixture.js";
import { applyRemovalManifestUpdate, planOwnedCssChunkRemoval } from "./css.js";

describe("planOwnedCssChunkRemoval", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-remove-plan-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("plans removal of a pristine managed chunk with no notices", () => {
    const config = styledConfig();
    const { hash } = seedChunk(root, config);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]?.content).not.toContain(hash);
    expect(plan.preservedNotices).toEqual([]);
    expect([...plan.retainedChunkHashesByName.keys()]).toEqual([]);
  });

  test("preserves an edited chunk and emits a drift notice without --force", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(root, config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.writes).toEqual([]);
    expect(plan.preservedNotices).toHaveLength(1);
    expect(plan.preservedNotices[0]).toContain("dialog-shell");
    expect(plan.preservedNotices[0]).toContain("use --force to override");
    expect(readFileSync(stylesPath, "utf-8")).toContain("--user-edit: teal;");
  });

  // Regression (orphan): a preserved drifted chunk must keep its owner
  // tracked so the block stays targetable by `remove --force`, not orphaned.
  test("keeps the drifted chunk's owner tracked so its block is not orphaned", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(root, config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect([...plan.retainedChunkHashesByName.keys()]).toEqual(["dialog-shell"]);
    expect(plan.preservedNotices[0]).toContain("tracked");
    expect(plan.preservedNotices[0]).toContain("re-run remove with --force");
  });

  test.each<[string, (content: string, hash: string) => string]>([
    [
      "unmatched",
      (content: string, hash: string) => content.replace(`\n/* dgadd:css-end ${hash} */`, ""),
    ],
    [
      "reversed",
      (content: string, hash: string) =>
        content
          .replace(`/* dgadd:css ${hash} */`, "/* marker-placeholder */")
          .replace(`/* dgadd:css-end ${hash} */`, `/* dgadd:css ${hash} */`)
          .replace("/* marker-placeholder */", `/* dgadd:css-end ${hash} */`),
    ],
    [
      "duplicate",
      (content: string, hash: string) =>
        content.replace(
          `/* dgadd:css ${hash} */`,
          `/* dgadd:css ${hash} */\n/* dgadd:css ${hash} */`,
        ),
    ],
    [
      "overlapping",
      (content: string, hash: string) =>
        content
          .replace(
            `/* dgadd:css ${hash} */`,
            `/* dgadd:css ${hash} */\n/* dgadd:css 0123456789abcdef */`,
          )
          .replace(
            `/* dgadd:css-end ${hash} */`,
            `/* dgadd:css-end ${hash} */\n/* dgadd:css-end 0123456789abcdef */`,
          ),
    ],
  ])("preserves ownership for %s managed markers", (_shape, corrupt) => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(root, config);
    writeFileSync(stylesPath, corrupt(readFileSync(stylesPath, "utf-8"), hash));
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.writes).toEqual([]);
    expect([...plan.retainedChunkHashesByName.keys()]).toEqual(["dialog-shell"]);
    expect(plan.preservedNotices[0]).toContain("markers are malformed");
    expect(readFileSync(stylesPath, "utf-8")).toContain(`/* dgadd:css ${hash} */`);
  });

  test("rejects --force when a managed chunk has incomplete markers", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(root, config);
    const edited = readFileSync(stylesPath, "utf-8").replace(`\n/* dgadd:css-end ${hash} */`, "\n");
    writeFileSync(stylesPath, edited);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    expect(() => planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, true)).toThrow(
      /markers are malformed/,
    );
    expect(readFileSync(stylesPath, "utf-8")).toContain(`/* dgadd:css ${hash} */`);
  });

  test("--force overrides an edited chunk and drops its body from the write", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(root, config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, true);

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]?.content).not.toContain(hash);
    expect(plan.writes[0]?.content).not.toContain("--user-edit: teal;");
    expect(plan.preservedNotices).toEqual([]);
    expect([...plan.retainedChunkHashesByName.keys()]).toEqual([]);
  });
});

describe("applyRemovalManifestUpdate", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-retain-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeManifest(installedItems: Record<string, unknown>) {
    const config = DiffgazerAddConfigSchema.parse({
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      componentsFsPath: "src/components/ui",
      libFsPath: "src/lib",
      hooksFsPath: "src/hooks",
      tailwind: { css: "src/styles/styles.css" },
      installedItems,
    });
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(config, null, 2));
    return config;
  }

  function readManifest(): Record<string, Record<string, unknown>> {
    return JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")).installedItems;
  }

  // Regression: a chunk-only retained record must not keep `files` for source
  // files the same remove deleted, or `dgadd diff` reports spurious drift.
  test("drops deleted source files from a retained record, keeping only chunk tracking", () => {
    const capturedConfig = writeManifest({
      "ui/dialog-shell": {
        installedAt: "2026-01-01T00:00:00.000Z",
        installedAs: "transitive",
        integrationMode: "copy",
        cssChunks: ["bb0d8428fe488e4d"],
        files: [
          { path: "src/components/ui/shared/dialog-shell.tsx", hash: "abc", item: "dialog-shell" },
        ],
      },
      "ui/button": {
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [{ path: "src/components/ui/button/button.tsx", hash: "def", item: "button" }],
      },
    });

    applyRemovalManifestUpdate(
      root,
      capturedConfig,
      [],
      new Map([["ui/dialog-shell", ["bb0d8428fe488e4d"]]]),
    );

    const manifest = readManifest();
    expect(manifest["ui/dialog-shell"]).toEqual({
      installedAt: "2026-01-01T00:00:00.000Z",
      installedAs: "transitive",
      integrationMode: "copy",
      cssChunks: ["bb0d8428fe488e4d"],
    });
    expect(manifest["ui/button"]?.files).toBeDefined();
  });

  // Regression: only drifted chunks survive on disk; a pristine sibling chunk
  // deleted from styles.css must drop from `cssChunks` or diff reports drift.
  test("drops a deleted pristine sibling chunk, keeping only preserved chunk hashes", () => {
    const capturedConfig = writeManifest({
      "ui/dialog-shell": {
        installedAt: "2026-01-01T00:00:00.000Z",
        installedAs: "transitive",
        integrationMode: "copy",
        cssChunks: ["deadbeef00000000", "cafebabe00000000"],
        files: [
          { path: "src/components/ui/shared/dialog-shell.tsx", hash: "abc", item: "dialog-shell" },
        ],
      },
    });

    applyRemovalManifestUpdate(
      root,
      capturedConfig,
      [],
      new Map([["ui/dialog-shell", ["deadbeef00000000"]]]),
    );

    expect(readManifest()["ui/dialog-shell"]).toEqual({
      installedAt: "2026-01-01T00:00:00.000Z",
      installedAs: "transitive",
      integrationMode: "copy",
      cssChunks: ["deadbeef00000000"],
    });
  });

  test("preserves unknown manifest metadata while trimming files and CSS chunks", () => {
    const rawConfig = {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      installedItems: {
        "ui/dialog-shell": {
          installedAt: "2026-01-01T00:00:00.000Z",
          installedAs: "transitive",
          integrationMode: "copy",
          keysVersion: "^1.2.3",
          futureRecord: { enabled: true, note: "keep me" },
          cssChunks: ["deadbeef00000000", "cafebabe00000000"],
          files: [
            {
              path: "src/components/ui/shared/dialog-shell.tsx",
              hash: "abc",
              item: "dialog-shell",
            },
          ],
        },
      },
    };
    writeFileSync(join(root, "diffgazer.json"), JSON.stringify(rawConfig, null, 2));

    applyRemovalManifestUpdate(
      root,
      rawConfig as DiffgazerAddConfig,
      [],
      new Map([["ui/dialog-shell", ["deadbeef00000000"]]]),
    );

    const record = readManifest()["ui/dialog-shell"];
    expect(record).toMatchObject({
      keysVersion: "^1.2.3",
      futureRecord: { enabled: true, note: "keep me" },
      cssChunks: ["deadbeef00000000"],
    });
    expect(record?.files).toBeUndefined();
  });

  test("is a no-op when no names are retained", () => {
    const capturedConfig = writeManifest({
      "ui/button": {
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [{ path: "src/components/ui/button/button.tsx", hash: "def", item: "button" }],
      },
    });

    applyRemovalManifestUpdate(root, capturedConfig, [], new Map());

    expect(readManifest()["ui/button"]?.files).toBeDefined();
  });

  test("uses the captured config instead of reloading diffgazer.json", () => {
    const capturedConfig = writeManifest({
      "ui/dialog-shell": {
        installedAt: "2026-01-01T00:00:00.000Z",
        cssChunks: ["bb0d8428fe488e4d"],
      },
    });
    writeFileSync(join(root, "diffgazer.json"), "{ broken\n");

    expect(() =>
      applyRemovalManifestUpdate(
        root,
        capturedConfig,
        [],
        new Map([["ui/dialog-shell", ["bb0d8428fe488e4d"]]]),
      ),
    ).not.toThrow();
    expect(readManifest()["ui/dialog-shell"]?.cssChunks).toEqual(["bb0d8428fe488e4d"]);
  });

  test("throws when a retained name has no manifest record", () => {
    const capturedConfig = writeManifest({
      "ui/button": {
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [{ path: "src/components/ui/button/button.tsx", hash: "def", item: "button" }],
      },
    });

    expect(() =>
      applyRemovalManifestUpdate(
        root,
        capturedConfig,
        [],
        new Map([["ui/dialog-shell", ["bb0d8428fe488e4d"]]]),
      ),
    ).toThrow(/missing record for ui\/dialog-shell/);
  });
});
