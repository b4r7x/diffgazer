import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { ResolvedConfig } from "../context.js";
import { planComponentCss } from "../utils/css-chunks.js";
import {
  createRemoveWorkflowContext,
  planOwnedCssChunkRemoval,
  retainCssChunkTrackingOnly,
} from "./remove.js";

describe("RemoveWorkflowContext", () => {
  test("starts with no active cwd and no snapshot", () => {
    const ctx = createRemoveWorkflowContext();
    expect(ctx.activeCwd).toBeNull();
    expect(ctx.preRemovalChunksByItem.size).toBe(0);
  });

  test("records cwd and chunk snapshot during an invocation", () => {
    const ctx = createRemoveWorkflowContext();
    ctx.beginInvocation("/projects/app-a");
    ctx.snapshotPreRemovalChunks(new Map([["ui/button", ["abc"]]]));

    expect(ctx.activeCwd).toBe("/projects/app-a");
    expect(ctx.preRemovalChunksByItem.get("ui/button")).toEqual(["abc"]);
  });

  test("a new invocation clears the previous invocation's snapshot and cwd", () => {
    const ctx = createRemoveWorkflowContext();
    ctx.beginInvocation("/projects/app-a");
    ctx.snapshotPreRemovalChunks(new Map([["ui/button", ["abc"]]]));

    ctx.beginInvocation("/projects/app-b");

    expect(ctx.activeCwd).toBe("/projects/app-b");
    expect(ctx.preRemovalChunksByItem.size).toBe(0);
  });
});

describe("planOwnedCssChunkRemoval", () => {
  let root: string;

  function styledConfig(): ResolvedConfig {
    return {
      aliases: {
        components: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
      rsc: false,
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      stylesFsPath: "src/styles",
      tailwind: { css: "src/styles/styles.css" },
    };
  }

  function seedChunk(config: ResolvedConfig): { stylesPath: string; hash: string } {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    const stylesPath = join(root, "src/styles/styles.css");
    writeFileSync(stylesPath, "/* base */\n");
    const plan = planComponentCss(["dialog-shell"], root, config);
    if (!plan.fileOp) throw new Error("Expected dialog-shell to add a CSS chunk.");
    writeFileSync(stylesPath, plan.fileOp.content);
    const [hash] = plan.chunksByItem.get("ui/dialog-shell") ?? [];
    if (!hash) throw new Error("Expected dialog-shell to record a chunk hash.");
    return { stylesPath, hash };
  }

  function editChunkBody(stylesPath: string, hash: string): void {
    const edited = readFileSync(stylesPath, "utf-8").replace(
      `/* dgadd:css-end ${hash} */`,
      `  --user-edit: teal;\n/* dgadd:css-end ${hash} */`,
    );
    writeFileSync(stylesPath, edited);
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-remove-plan-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test("plans removal of a pristine managed chunk with no notices", () => {
    const config = styledConfig();
    const { hash } = seedChunk(config);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]?.content).not.toContain(hash);
    expect(plan.preservedNotices).toEqual([]);
    expect(plan.retainedNames).toEqual([]);
  });

  test("preserves an edited chunk and emits a drift notice without --force", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.writes).toEqual([]);
    expect(plan.preservedNotices).toHaveLength(1);
    expect(plan.preservedNotices[0]).toContain("dialog-shell");
    expect(plan.preservedNotices[0]).toContain("use --force to override");
    expect(readFileSync(stylesPath, "utf-8")).toContain("--user-edit: teal;");
  });

  // Regression (F-077 orphan): a preserved drifted chunk must keep its owner
  // tracked so the block stays targetable by `remove --force`, not orphaned.
  test("keeps the drifted chunk's owner tracked so its block is not orphaned", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, false);

    expect(plan.retainedNames).toEqual(["dialog-shell"]);
    expect(plan.preservedNotices[0]).toContain("tracked");
    expect(plan.preservedNotices[0]).toContain("re-run remove with --force");
  });

  test("--force overrides an edited chunk and drops its body from the write", () => {
    const config = styledConfig();
    const { stylesPath, hash } = seedChunk(config);
    editChunkBody(stylesPath, hash);
    const snapshot = new Map([["dialog-shell", [hash]]]);

    const plan = planOwnedCssChunkRemoval(root, config, ["dialog-shell"], snapshot, true);

    expect(plan.writes).toHaveLength(1);
    expect(plan.writes[0]?.content).not.toContain(hash);
    expect(plan.writes[0]?.content).not.toContain("--user-edit: teal;");
    expect(plan.preservedNotices).toEqual([]);
    expect(plan.retainedNames).toEqual([]);
  });
});

describe("retainCssChunkTrackingOnly", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "dgadd-retain-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeManifest(installedComponents: Record<string, unknown>): void {
    writeFileSync(
      join(root, "diffgazer.json"),
      JSON.stringify(
        {
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
          installedComponents,
        },
        null,
        2,
      ),
    );
  }

  function readManifest(): Record<string, Record<string, unknown>> {
    return JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")).installedComponents;
  }

  // Regression: a chunk-only retained record must not keep `files` for source
  // files the same remove deleted, or `dgadd diff` reports spurious drift.
  test("drops deleted source files from a retained record, keeping only chunk tracking", () => {
    writeManifest({
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

    retainCssChunkTrackingOnly(root, new Map([["ui/dialog-shell", ["bb0d8428fe488e4d"]]]));

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
    writeManifest({
      "ui/dialog-shell": {
        installedAt: "2026-01-01T00:00:00.000Z",
        installedAs: "transitive",
        integrationMode: "copy",
        cssChunks: ["drifted0000000000", "pristine000000000"],
        files: [
          { path: "src/components/ui/shared/dialog-shell.tsx", hash: "abc", item: "dialog-shell" },
        ],
      },
    });

    retainCssChunkTrackingOnly(root, new Map([["ui/dialog-shell", ["drifted0000000000"]]]));

    expect(readManifest()["ui/dialog-shell"]).toEqual({
      installedAt: "2026-01-01T00:00:00.000Z",
      installedAs: "transitive",
      integrationMode: "copy",
      cssChunks: ["drifted0000000000"],
    });
  });

  test("is a no-op when no names are retained", () => {
    writeManifest({
      "ui/button": {
        installedAt: "2026-01-01T00:00:00.000Z",
        files: [{ path: "src/components/ui/button/button.tsx", hash: "def", item: "button" }],
      },
    });

    retainCssChunkTrackingOnly(root, new Map());

    expect(readManifest()["ui/button"]?.files).toBeDefined();
  });
});
