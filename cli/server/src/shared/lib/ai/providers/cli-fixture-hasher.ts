import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";

export const FIXTURE_TREE_ENTRY_KINDS = ["file", "directory"] as const;
export type FixtureTreeEntryKind = (typeof FIXTURE_TREE_ENTRY_KINDS)[number];

export type FixtureTreeManifestEntry = Readonly<{
  relativePath: string;
  kind: FixtureTreeEntryKind;
  executable: boolean;
  byteLength: number;
  sha256: string | null;
}>;

export type FixtureTreeManifest = Readonly<{
  entries: readonly FixtureTreeManifestEntry[];
}>;

export type FixtureTreeSnapshot = Readonly<{
  treeSha256: string;
  manifest: FixtureTreeManifest;
}>;

export type FixtureTreeVerification = Readonly<{
  ok: boolean;
  treeSha256: string;
  expectedTreeSha256: string;
  changedPaths: readonly string[];
}>;

function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256FileBytes(bytes: Buffer): string {
  return sha256Hex(bytes);
}

export function normalizeFixtureRelativePath(root: string, targetPath: string): string {
  const relative = path.relative(root, targetPath);
  return relative.split(path.sep).join("/");
}

async function isExecutable(filePath: string, mode: number): Promise<boolean> {
  if (process.platform === "win32") {
    try {
      await access(filePath, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
  return (mode & 0o111) !== 0;
}

async function collectFixtureEntries(
  root: string,
  currentPath = root,
): Promise<FixtureTreeManifestEntry[]> {
  const entries: FixtureTreeManifestEntry[] = [];
  const children = await readdir(currentPath, { withFileTypes: true });

  for (const child of children) {
    const absolutePath = path.join(currentPath, child.name);
    const relativePath = normalizeFixtureRelativePath(root, absolutePath);
    if (child.isDirectory()) {
      entries.push({
        relativePath,
        kind: "directory",
        executable: false,
        byteLength: 0,
        sha256: null,
      });
      const nested = await collectFixtureEntries(root, absolutePath);
      entries.push(...nested);
      continue;
    }

    if (!child.isFile()) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    const bytes = await readFile(absolutePath);
    entries.push({
      relativePath,
      kind: "file",
      executable: await isExecutable(absolutePath, fileStat.mode),
      byteLength: bytes.byteLength,
      sha256: sha256FileBytes(bytes),
    });
  }

  return entries;
}

export function sortFixtureManifestEntries(
  entries: readonly FixtureTreeManifestEntry[],
): FixtureTreeManifestEntry[] {
  return [...entries].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function hashFixtureTreeManifest(manifest: FixtureTreeManifest): string {
  const entries = sortFixtureManifestEntries(manifest.entries);
  return sha256CanonicalJsonSync({ entries });
}

export async function snapshotFixtureTree(root: string): Promise<FixtureTreeSnapshot> {
  const entries = sortFixtureManifestEntries(await collectFixtureEntries(root));
  const manifest: FixtureTreeManifest = { entries };
  return {
    manifest,
    treeSha256: hashFixtureTreeManifest(manifest),
  };
}

export function compareFixtureTreeSnapshots(
  before: FixtureTreeSnapshot,
  after: FixtureTreeSnapshot,
): FixtureTreeVerification {
  const beforeByPath = new Map(before.manifest.entries.map((entry) => [entry.relativePath, entry]));
  const afterByPath = new Map(after.manifest.entries.map((entry) => [entry.relativePath, entry]));
  const changedPaths: string[] = [];

  for (const [relativePath, beforeEntry] of beforeByPath) {
    const afterEntry = afterByPath.get(relativePath);
    if (!afterEntry) {
      changedPaths.push(relativePath);
      continue;
    }
    if (
      beforeEntry.kind !== afterEntry.kind ||
      beforeEntry.executable !== afterEntry.executable ||
      beforeEntry.byteLength !== afterEntry.byteLength ||
      beforeEntry.sha256 !== afterEntry.sha256
    ) {
      changedPaths.push(relativePath);
    }
  }

  for (const relativePath of afterByPath.keys()) {
    if (!beforeByPath.has(relativePath)) {
      changedPaths.push(relativePath);
    }
  }

  const treeUnchanged =
    before.treeSha256 === after.treeSha256 && changedPaths.length === 0 && before.treeSha256 !== "";
  return {
    ok: treeUnchanged,
    treeSha256: after.treeSha256,
    expectedTreeSha256: before.treeSha256,
    changedPaths: [...changedPaths].sort((left, right) => left.localeCompare(right)),
  };
}

export async function verifyFixtureTreeUnchanged(
  root: string,
  expected: FixtureTreeSnapshot,
): Promise<FixtureTreeVerification> {
  const after = await snapshotFixtureTree(root);
  return compareFixtureTreeSnapshots(expected, after);
}
