import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import type { ProjectContextSnapshot } from "@diffgazer/core/schemas/context";
import { createGitService } from "../../../../shared/lib/git/service.js";
import { createKeyedLock } from "../../storage/keyed-lock.js";
import { loadContextSnapshot, publishContextSnapshot, resolvesWithinRoot } from "./artifacts.js";
import { buildSnapshotContent } from "./content.js";

const snapshotLocks = new Map<string, Promise<unknown>>();
const lockSnapshot = createKeyedLock(snapshotLocks);

function withSnapshotLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  return lockSnapshot(projectPath, fn);
}

export function buildProjectContextSnapshot(
  projectPath: string,
  options: { force?: boolean } = {},
): Promise<ProjectContextSnapshot> {
  return withSnapshotLock(projectPath, () => buildSnapshot(projectPath, options));
}

async function buildSnapshot(
  projectPath: string,
  options: { force?: boolean },
): Promise<ProjectContextSnapshot> {
  const normalizedRoot = await realpath(projectPath).catch(() => path.resolve(projectPath));
  const contextDir = path.join(projectPath, ".diffgazer");
  if (!(await resolvesWithinRoot(contextDir, normalizedRoot))) {
    throw new Error("Context cache directory resolves outside the project root");
  }
  await mkdir(contextDir, { recursive: true, mode: 0o700 });

  const gitService = createGitService({ cwd: projectPath });
  const [statusHashResult, headCommitResult] = await Promise.all([
    gitService.getStatusHash().catch(() => ({ kind: "unavailable" as const })),
    gitService.getHeadCommit().catch(() => ({ ok: false as const, error: { message: "unknown" } })),
  ]);
  const currentHash = statusHashResult.kind === "unavailable" ? "" : statusHashResult.hash;
  const currentHashKind = statusHashResult.kind;
  const currentHeadCommit = headCommitResult.ok ? headCommitResult.value : "";

  const cached = await loadContextSnapshot(contextDir);
  if (
    cached &&
    !options.force &&
    currentHashKind === "full" &&
    cached.meta.statusHashKind === "full" &&
    cached.meta.statusHash === currentHash &&
    (cached.meta.headCommit ?? "") === currentHeadCommit
  ) {
    return cached;
  }

  const snapshot = await buildSnapshotContent({
    projectPath,
    normalizedRoot,
    statusHash: currentHash,
    statusHashKind: currentHashKind,
    headCommit: currentHeadCommit,
  });
  await publishContextSnapshot(contextDir, snapshot);
  return snapshot;
}
