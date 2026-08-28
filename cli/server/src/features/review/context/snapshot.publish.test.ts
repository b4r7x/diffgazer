import { lstat, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_CONTEXT_MANIFEST_JSON_BYTES } from "@diffgazer/core/schemas/context";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publishContextSnapshot } from "./snapshot/artifacts.js";
import {
  listSnapshotGenerations,
  readJson,
  snapshotArtifactNames,
  writeSnapshotFixture,
} from "./testing/snapshot-fixtures.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "diffgazer-context-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe("publishContextSnapshot", () => {
  const baseGraph = () => ({
    generatedAt: "2025-01-01",
    root: projectRoot,
    packages: [],
    edges: [],
    fileTree: [],
    changedFiles: [],
  });

  const baseMeta = () => ({
    generatedAt: "2025-01-01",
    root: projectRoot,
    statusHash: "hash-1",
    statusHashKind: "full" as const,
    charCount: 10,
  });

  it("cleanup unlinks only regular files matching the generation naming contract", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const previousGeneration = "prev-gen";
    const graph = baseGraph();
    const meta = baseMeta();
    await writeSnapshotFixture(
      contextDir,
      { markdown: "# previous", graph, meta },
      previousGeneration,
    );

    const previousNames = snapshotArtifactNames(previousGeneration);
    await rm(join(contextDir, previousNames.markdown));
    await mkdir(join(contextDir, previousNames.markdown));

    const junkGeneration = "junk-gen";
    const junkNames = snapshotArtifactNames(junkGeneration);
    const symlinkTarget = join(projectRoot, "symlink-target.json");
    await writeFile(symlinkTarget, "{}", "utf-8");
    await symlink(symlinkTarget, join(contextDir, junkNames.graph));

    const orphanGeneration = "orphan-gen";
    const orphanNames = snapshotArtifactNames(orphanGeneration);
    await writeFile(join(contextDir, orphanNames.meta), "{}", "utf-8");

    const markdown = "# published";
    await publishContextSnapshot(contextDir, {
      markdown,
      graph,
      meta: { ...meta, charCount: markdown.length },
    });

    const entries = new Set(await readdir(contextDir));
    // Non-regular retained previous markdown dir is skipped.
    expect(entries.has(previousNames.markdown)).toBe(true);
    expect((await stat(join(contextDir, previousNames.markdown))).isDirectory()).toBe(true);
    // Non-regular orphan symlink is skipped.
    expect(entries.has(junkNames.graph)).toBe(true);
    expect((await lstat(join(contextDir, junkNames.graph))).isSymbolicLink()).toBe(true);
    // Previous generation is retained (active + previous), so its regular files remain.
    expect(entries.has(previousNames.graph)).toBe(true);
    expect(entries.has(previousNames.meta)).toBe(true);
    // Non-retained orphan regular file is unlinked.
    expect(entries.has(orphanNames.meta)).toBe(false);

    const manifest = await readJson<{ generation: string }>(
      join(contextDir, "context.manifest.json"),
    );
    for (const fileName of Object.values(snapshotArtifactNames(manifest.generation))) {
      expect(entries.has(fileName)).toBe(true);
      expect((await stat(join(contextDir, fileName))).isFile()).toBe(true);
    }
  });

  it("does not retain a previous generation from an oversized manifest", async () => {
    const contextDir = join(projectRoot, ".diffgazer");
    const previousGeneration = "prev-gen";
    const graph = baseGraph();
    const meta = baseMeta();
    await writeSnapshotFixture(
      contextDir,
      { markdown: "# previous", graph, meta },
      previousGeneration,
    );

    const padding = "x".repeat(MAX_CONTEXT_MANIFEST_JSON_BYTES);
    await writeFile(
      join(contextDir, "context.manifest.json"),
      `{"generation":"${previousGeneration}","padding":"${padding}"}`,
      "utf-8",
    );

    const markdown = "# published";
    await publishContextSnapshot(contextDir, {
      markdown,
      graph,
      meta: { ...meta, charCount: markdown.length },
    });

    const manifest = await readJson<{ generation: string }>(
      join(contextDir, "context.manifest.json"),
    );
    const generations = listSnapshotGenerations(await readdir(contextDir));
    expect(generations.size).toBe(1);
    expect(generations.has(manifest.generation)).toBe(true);
    expect(generations.has(previousGeneration)).toBe(false);
    const entries = new Set(await readdir(contextDir));
    for (const fileName of Object.values(snapshotArtifactNames(previousGeneration))) {
      expect(entries.has(fileName)).toBe(false);
    }
  });
});
