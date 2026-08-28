import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf-8")) as T;
}

export function snapshotArtifactNames(generation: string) {
  return {
    markdown: `context.${generation}.md`,
    graph: `context.${generation}.json`,
    meta: `context.${generation}.meta.json`,
  } as const;
}

export function listSnapshotGenerations(entries: readonly string[]): Set<string> {
  const generations = new Set<string>();
  for (const entry of entries) {
    if (entry === "context.manifest.json") continue;
    const match = /^context\.([A-Za-z0-9_-]{1,128})\.(?:md|json|meta\.json)$/.exec(entry);
    if (match?.[1]) generations.add(match[1]);
  }
  return generations;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function writeSnapshotFixture(
  contextDir: string,
  snapshot: { markdown: string; graph: unknown; meta: unknown },
  generation = "fixture",
): Promise<void> {
  const names = snapshotArtifactNames(generation);
  const graphContent = JSON.stringify(snapshot.graph, null, 2);
  const metaContent = JSON.stringify(snapshot.meta, null, 2);
  await mkdir(contextDir, { recursive: true });
  await writeFile(join(contextDir, names.markdown), snapshot.markdown, "utf-8");
  await writeFile(join(contextDir, names.graph), graphContent, "utf-8");
  await writeFile(join(contextDir, names.meta), metaContent, "utf-8");
  await writeJson(join(contextDir, "context.manifest.json"), {
    version: 1,
    generation,
    artifacts: {
      markdown: { file: names.markdown, sha256: sha256(snapshot.markdown) },
      graph: { file: names.graph, sha256: sha256(graphContent) },
      meta: { file: names.meta, sha256: sha256(metaContent) },
    },
  });
}

export async function readCurrentSnapshotFiles(contextDir: string) {
  const manifest = await readJson<{
    artifacts: {
      markdown: { file: string };
      graph: { file: string };
      meta: { file: string };
    };
  }>(join(contextDir, "context.manifest.json"));
  return {
    markdown: await readFile(join(contextDir, manifest.artifacts.markdown.file), "utf-8"),
    graph: await readJson<unknown>(join(contextDir, manifest.artifacts.graph.file)),
    meta: await readJson<unknown>(join(contextDir, manifest.artifacts.meta.file)),
  };
}
