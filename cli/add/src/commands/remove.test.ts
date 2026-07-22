import { describe, expect, test } from "vitest";
import type { ResolvedConfig } from "../context.js";
import { createRemoveWorkflowContext } from "./remove/css.js";
import { resolveRemoveTransactionFiles } from "./remove.js";

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

describe("resolveRemoveTransactionFiles", () => {
  test("snapshots the manifest and configured stylesheet for the CLI transaction", () => {
    const config: ResolvedConfig = {
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

    expect(resolveRemoveTransactionFiles("/projects/app", config)).toEqual([
      "/projects/app/diffgazer.json",
      "/projects/app/src/styles/styles.css",
    ]);
  });

  test("snapshots only the manifest when the project has no configured stylesheet", () => {
    const config: ResolvedConfig = {
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
      tailwind: undefined,
    };

    expect(resolveRemoveTransactionFiles("/projects/app", config)).toEqual([
      "/projects/app/diffgazer.json",
    ]);
  });
});
