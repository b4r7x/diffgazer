import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareFixtureTreeSnapshots,
  snapshotFixtureTree,
  verifyFixtureTreeUnchanged,
} from "./cli-fixture-hasher.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

async function createFixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "cli-fixture-hasher-"));
  tempDirs.push(root);
  await mkdir(path.join(root, "nested"), { recursive: true });
  await writeFile(path.join(root, "sentinel-preserve.txt"), "PRESERVE\n");
  await writeFile(path.join(root, "sentinel-delete.txt"), "DELETE-ME\n");
  await writeFile(path.join(root, "sentinel-rename.txt"), "RENAME-ME\n");
  await writeFile(path.join(root, "nested", "unchanged.txt"), "NESTED\n");
  return root;
}

describe("canonical fixture tree hasher", () => {
  it("detects byte changes in fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await writeFile(path.join(root, "sentinel-preserve.txt"), "OVERWRITTEN\n");
    const after = await snapshotFixtureTree(root);
    const verification = compareFixtureTreeSnapshots(before, after);
    expect(verification.ok).toBe(false);
    expect(verification.changedPaths).toContain("sentinel-preserve.txt");
  });

  it("detects added fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await writeFile(path.join(root, "created-by-agent.txt"), "CREATED\n");
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects removed fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await rm(path.join(root, "sentinel-delete.txt"));
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects renamed fixture files", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await rename(path.join(root, "sentinel-rename.txt"), path.join(root, "renamed-by-agent.txt"));
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("detects executable-bit changes", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    await chmod(path.join(root, "nested", "unchanged.txt"), 0o755);
    const after = await snapshotFixtureTree(root);
    expect(compareFixtureTreeSnapshots(before, after).ok).toBe(false);
  });

  it("verifies unchanged fixture trees with equal hashes", async () => {
    const root = await createFixtureRoot();
    const before = await snapshotFixtureTree(root);
    const verification = await verifyFixtureTreeUnchanged(root, before);
    expect(verification.ok).toBe(true);
    expect(verification.treeSha256).toBe(before.treeSha256);
  });
});
