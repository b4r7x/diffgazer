import { describe, expect, test } from "vitest";
import { createRemoveWorkflowContext } from "./remove.js";

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
