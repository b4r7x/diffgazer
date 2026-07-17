import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  rmdir,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withFileTransactionLock } from "./transaction.js";

const transactionModuleUrl = new URL("./transaction.ts", import.meta.url).href;

const lockWorker = `
import { access, appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const waitForFile = async (filePath) => {
  while (true) {
    try {
      await access(filePath);
      return;
    } catch {
      await delay(2);
    }
  }
};

const { withFileTransactionLock } = await import(process.env.TRANSACTION_MODULE_URL);
if (process.env.START_PATH) {
  await writeFile(process.env.START_READY_PATH, "ready");
  await waitForFile(process.env.START_PATH);
}

await withFileTransactionLock(process.env.TARGET_PATH, async () => {
  if (process.env.MODE === "trust-grant" || process.env.MODE === "trust-revoke") {
    if (process.env.READY_PATH) await writeFile(process.env.READY_PATH, "ready");
    if (process.env.RELEASE_PATH) await waitForFile(process.env.RELEASE_PATH);
    let trust = { projects: {} };
    try {
      trust = JSON.parse(await (await import("node:fs/promises")).readFile(
        process.env.TARGET_PATH,
        "utf8",
      ));
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    if (process.env.MODE === "trust-grant") {
      trust.projects.target = {
        projectId: "target",
        repoRoot: "/projects/target",
        trustedAt: "2026-01-01T00:00:00.000Z",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
      };
    } else {
      delete trust.projects.target;
    }
    await writeFile(process.env.TARGET_PATH, JSON.stringify(trust));
    return;
  }

  if (process.env.MODE === "hold") {
    await writeFile(process.env.READY_PATH, "ready");
    await new Promise(() => {});
  }

  if (process.env.MODE === "hold-until-release" || process.env.MODE === "contend") {
    let ownsActiveDirectory = false;
    try {
      await mkdir(process.env.ACTIVE_PATH);
      ownsActiveDirectory = true;
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      await appendFile(process.env.OVERLAP_PATH, "overlap\\n");
    }

    try {
      if (process.env.MODE === "hold-until-release") {
        await writeFile(process.env.READY_PATH, "ready");
        await waitForFile(process.env.RELEASE_PATH);
      } else {
        await delay(Number(process.env.HOLD_MS));
      }
    } finally {
      if (ownsActiveDirectory) await rm(process.env.ACTIVE_PATH, { recursive: true });
    }
    return;
  }

  await writeFile(process.env.TARGET_PATH, "acquired");
}, {
  timeoutMs: Number(process.env.LOCK_TIMEOUT_MS ?? 5000),
  staleMs: Number(process.env.LOCK_STALE_MS ?? 60000),
  retryMs: Number(process.env.LOCK_RETRY_MS ?? 2),
});
`;

const stagingWorker = `
import { mkdir, writeFile } from "node:fs/promises";
await mkdir(process.env.STAGING_PATH, { mode: 0o700 });
await writeFile(
  process.env.MARKER_PATH,
  JSON.stringify({ ownerId: process.env.OWNER_ID, pid: process.pid, createdAt: Date.now() }),
  { mode: 0o600 },
);
await writeFile(process.env.READY_PATH, "ready");
await new Promise(() => {});
`;

interface LockMetadata {
  ownerId: string;
  pid: number;
  createdAt: number;
}

const createLockGeneration = async (
  lockPath: string,
  metadata: LockMetadata,
  content = `${JSON.stringify(metadata)}\n`,
): Promise<string> => {
  const markerName = `${metadata.ownerId}.json`;
  await mkdir(lockPath, { mode: 0o700 });
  await writeFile(join(lockPath, markerName), content, { mode: 0o600 });
  return markerName;
};

const waitForFile = async (filePath: string): Promise<void> => {
  const deadline = Date.now() + 10_000;
  while (true) {
    try {
      await access(filePath);
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${filePath}`);
      await delay(10);
    }
  }
};

const waitForPendingLock = async (lockPath: string): Promise<void> => {
  const deadline = Date.now() + 10_000;
  const prefix = `${basename(lockPath)}.`;
  while (true) {
    const entries = await readdir(dirname(lockPath));
    if (entries.some((entry) => entry.startsWith(prefix) && entry.endsWith(".pending"))) return;
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for contender on ${lockPath}`);
    await delay(10);
  }
};

const waitForExit = (child: ChildProcess): Promise<{ code: number | null; stderr: string }> =>
  new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });

const spawnLockWorker = (env: Record<string, string>): ChildProcess =>
  spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", lockWorker], {
    env: { ...process.env, ...env, TRANSACTION_MODULE_URL: transactionModuleUrl },
    stdio: ["ignore", "ignore", "pipe"],
  });

const spawnStagingWorker = (env: Record<string, string>): ChildProcess =>
  spawn(process.execPath, ["--input-type=module", "--eval", stagingWorker], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "ignore", "pipe"],
  });

describe("file transaction lock", () => {
  let root: string;
  let targetPath: string;
  let lockPath: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "diffgazer-config-lock-"));
    targetPath = join(root, "config.json");
    lockPath = `${targetPath}.lock`;
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("does not steal a fresh corrupt lock directory", async () => {
    await mkdir(lockPath, { mode: 0o700 });
    await writeFile(join(lockPath, "corrupt.json"), "{");

    await expect(
      withFileTransactionLock(targetPath, async () => undefined, {
        timeoutMs: 20,
        staleMs: 60_000,
        retryMs: 2,
      }),
    ).rejects.toThrow("Timed out waiting for config transaction lock");
    expect(existsSync(lockPath)).toBe(true);
  });

  it("recovers an empty incomplete lock directory", async () => {
    await mkdir(lockPath, { mode: 0o700 });

    await withFileTransactionLock(targetPath, async () => undefined, {
      timeoutMs: 100,
      staleMs: 60_000,
      retryMs: 2,
    });

    expect(existsSync(lockPath)).toBe(false);
  });

  it("recovers an old corrupt lock directory", async () => {
    await mkdir(lockPath, { mode: 0o700 });
    await writeFile(join(lockPath, "corrupt.json"), "{");
    const old = new Date(Date.now() - 120_000);
    await utimes(lockPath, old, old);

    await withFileTransactionLock(
      targetPath,
      async () => {
        expect(existsSync(lockPath)).toBe(true);
      },
      { timeoutMs: 100, staleMs: 60_000, retryMs: 2 },
    );

    expect(existsSync(lockPath)).toBe(false);
  });

  it("recovers a lock owned by a process that no longer exists", async () => {
    await createLockGeneration(lockPath, {
      ownerId: randomUUID(),
      pid: 2_147_483_647,
      createdAt: Date.now(),
    });

    await withFileTransactionLock(targetPath, async () => undefined, {
      timeoutMs: 100,
      staleMs: 60_000,
      retryMs: 2,
    });

    expect(existsSync(lockPath)).toBe(false);
  });

  it("fails safe on a legacy non-directory lock and removes its staging directory", async () => {
    await writeFile(lockPath, "legacy", { mode: 0o600 });

    await expect(
      withFileTransactionLock(targetPath, async () => undefined, {
        timeoutMs: 20,
        staleMs: 1,
        retryMs: 2,
      }),
    ).rejects.toThrow("Timed out waiting for config transaction lock");

    await expect(readFile(lockPath, "utf8")).resolves.toBe("legacy");
    expect((await readdir(root)).filter((name) => name.endsWith(".pending"))).toEqual([]);
  });

  it("does not release a replacement generation", async () => {
    const replacementOwnerId = randomUUID();

    await withFileTransactionLock(targetPath, async () => {
      const [ownedMarker] = await readdir(lockPath);
      if (ownedMarker === undefined) throw new Error("Missing lock marker");
      await unlink(join(lockPath, ownedMarker));
      await rmdir(lockPath);
      await createLockGeneration(lockPath, {
        ownerId: replacementOwnerId,
        pid: process.pid,
        createdAt: Date.now(),
      });
    });

    expect(await readdir(lockPath)).toEqual([`${replacementOwnerId}.json`]);
  });

  it("never treats an aged PID-reused generation as stale", async () => {
    const ownerId = randomUUID();
    await createLockGeneration(lockPath, {
      ownerId,
      pid: process.pid,
      createdAt: Date.now() - 120_000,
    });
    const old = new Date(Date.now() - 120_000);
    await utimes(lockPath, old, old);

    await expect(
      withFileTransactionLock(targetPath, async () => undefined, {
        timeoutMs: 20,
        staleMs: 1,
        retryMs: 2,
      }),
    ).rejects.toThrow("Timed out waiting for config transaction lock");

    expect(await readdir(lockPath)).toEqual([`${ownerId}.json`]);
  });

  it("cleans dead and old corrupt staging generations without touching a live one", async () => {
    const lockBaseName = basename(lockPath);
    const deadOwnerId = randomUUID();
    const liveOwnerId = randomUUID();
    const corruptOwnerId = randomUUID();
    const deadStage = join(root, `${lockBaseName}.${deadOwnerId}.pending`);
    const liveStage = join(root, `${lockBaseName}.${liveOwnerId}.pending`);
    const corruptStage = join(root, `${lockBaseName}.${corruptOwnerId}.pending`);

    await createLockGeneration(deadStage, {
      ownerId: deadOwnerId,
      pid: 2_147_483_647,
      createdAt: Date.now(),
    });
    await createLockGeneration(liveStage, {
      ownerId: liveOwnerId,
      pid: process.pid,
      createdAt: Date.now() - 120_000,
    });
    await mkdir(corruptStage);
    await writeFile(join(corruptStage, "corrupt.json"), "{");
    const old = new Date(Date.now() - 120_000);
    await utimes(liveStage, old, old);
    await utimes(corruptStage, old, old);

    await withFileTransactionLock(targetPath, async () => undefined, {
      staleMs: 1,
      retryMs: 2,
    });

    expect(existsSync(deadStage)).toBe(false);
    expect(existsSync(corruptStage)).toBe(false);
    expect(existsSync(liveStage)).toBe(true);
  });

  it("cleans a pending generation whose staging process was killed", async () => {
    const ownerId = randomUUID();
    const stagingPath = `${lockPath}.${ownerId}.pending`;
    const readyPath = join(root, "staging-ready");
    const worker = spawnStagingWorker({
      MARKER_PATH: join(stagingPath, `${ownerId}.json`),
      OWNER_ID: ownerId,
      READY_PATH: readyPath,
      STAGING_PATH: stagingPath,
    });
    const workerExit = waitForExit(worker);
    await waitForFile(readyPath);

    worker.kill("SIGKILL");
    const crashed = await workerExit;
    expect(crashed.code).not.toBe(0);
    expect(existsSync(stagingPath)).toBe(true);

    await withFileTransactionLock(targetPath, async () => undefined);
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("releases its lock when the operation fails", async () => {
    await expect(
      withFileTransactionLock(targetPath, async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");

    expect(existsSync(lockPath)).toBe(false);
  });

  it("never steals an aged lock while its owner process is alive", async () => {
    let firstInside = false;
    let overlap = false;
    let reportFirstEntry = () => {};
    const firstEntered = new Promise<void>((resolve) => {
      reportFirstEntry = resolve;
    });
    const options = { timeoutMs: 500, staleMs: 20, retryMs: 2 };

    const first = withFileTransactionLock(
      targetPath,
      async () => {
        firstInside = true;
        reportFirstEntry();
        await delay(120);
        firstInside = false;
      },
      options,
    );
    await firstEntered;

    const second = withFileTransactionLock(
      targetPath,
      async () => {
        overlap = firstInside;
      },
      options,
    );

    await Promise.all([first, second]);
    expect(overlap).toBe(false);
  });

  it("prevents a delayed stale reaper from removing a replacement generation", async () => {
    const staleOwnerId = randomUUID();
    const staleMarker = await createLockGeneration(lockPath, {
      ownerId: staleOwnerId,
      pid: 2_147_483_647,
      createdAt: Date.now(),
    });
    await unlink(join(lockPath, staleMarker));

    const readyPath = join(root, "replacement-ready");
    const releasePath = join(root, "replacement-release");
    const activePath = join(root, "active");
    const overlapPath = join(root, "overlap");
    const holder = spawnLockWorker({
      ACTIVE_PATH: activePath,
      MODE: "hold-until-release",
      OVERLAP_PATH: overlapPath,
      READY_PATH: readyPath,
      RELEASE_PATH: releasePath,
      TARGET_PATH: targetPath,
    });
    const holderExit = waitForExit(holder);
    await waitForFile(readyPath);

    await expect(rmdir(lockPath)).rejects.toMatchObject({
      code: expect.stringMatching(/^(EEXIST|ENOTEMPTY)$/),
    });

    const contender = spawnLockWorker({
      ACTIVE_PATH: activePath,
      HOLD_MS: "1",
      LOCK_TIMEOUT_MS: "30",
      MODE: "contend",
      OVERLAP_PATH: overlapPath,
      TARGET_PATH: targetPath,
    });
    const contenderResult = await waitForExit(contender);
    expect(contenderResult.code).not.toBe(0);
    expect(contenderResult.stderr).toContain("Timed out waiting for config transaction lock");
    expect(existsSync(overlapPath)).toBe(false);

    await writeFile(releasePath, "release");
    await expect(holderExit).resolves.toEqual({ code: 0, stderr: "" });
    expect(existsSync(lockPath)).toBe(false);
  });

  it("serializes repeated multi-process stale recovery contention", async () => {
    const contenderCount = 24;
    const rounds = 3;

    for (let round = 0; round < rounds; round += 1) {
      const roundTargetPath = join(root, `config-${round}.json`);
      const roundLockPath = `${roundTargetPath}.lock`;
      const activePath = join(root, `active-${round}`);
      const overlapPath = join(root, `overlap-${round}`);
      const startPath = join(root, `start-${round}`);

      await mkdir(roundLockPath, { mode: 0o700 });
      await writeFile(join(roundLockPath, "corrupt.json"), "{");
      const old = new Date(Date.now() - 120_000);
      await utimes(roundLockPath, old, old);

      const workers = Array.from({ length: contenderCount }, (_, index) => {
        const startReadyPath = join(root, `ready-${round}-${index}`);
        return {
          child: spawnLockWorker({
            ACTIVE_PATH: activePath,
            HOLD_MS: "3",
            LOCK_RETRY_MS: "1",
            LOCK_STALE_MS: "60000",
            LOCK_TIMEOUT_MS: "10000",
            MODE: "contend",
            OVERLAP_PATH: overlapPath,
            START_PATH: startPath,
            START_READY_PATH: startReadyPath,
            TARGET_PATH: roundTargetPath,
          }),
          startReadyPath,
        };
      });

      await Promise.all(workers.map(({ startReadyPath }) => waitForFile(startReadyPath)));
      await writeFile(startPath, "start");
      const results = await Promise.all(workers.map(({ child }) => waitForExit(child)));

      expect(results).toEqual(
        Array.from({ length: contenderCount }, () => ({ code: 0, stderr: "" })),
      );
      const maxActive = existsSync(overlapPath) ? 2 : 1;
      expect(maxActive).toBe(1);
      expect(existsSync(activePath)).toBe(false);
      expect(existsSync(roundLockPath)).toBe(false);
    }
  }, 30_000);

  it("lets a new process recover the lock after its owner crashes", async () => {
    const readyPath = join(root, "holder-ready");
    const holder = spawnLockWorker({
      MODE: "hold",
      TARGET_PATH: targetPath,
      READY_PATH: readyPath,
    });
    const holderExit = waitForExit(holder);
    await waitForFile(readyPath);

    holder.kill("SIGKILL");
    const crashed = await holderExit;
    expect(crashed.code).not.toBe(0);
    expect(existsSync(lockPath)).toBe(true);

    const successor = spawnLockWorker({ MODE: "acquire", TARGET_PATH: targetPath });
    const result = await waitForExit(successor);

    expect(result).toEqual({ code: 0, stderr: "" });
    await expect(readFile(targetPath, "utf8")).resolves.toBe("acquired");
    expect(existsSync(lockPath)).toBe(false);
  });

  it.each([
    ["trust-grant", "trust-revoke", false],
    ["trust-revoke", "trust-grant", true],
  ])("resolves %s followed by %s in lock order without losing unrelated trust", async (firstMode, secondMode, targetRemains) => {
    await writeFile(
      targetPath,
      JSON.stringify({
        projects: {
          unrelated: {
            projectId: "unrelated",
            repoRoot: "/projects/unrelated",
            trustedAt: "2026-01-01T00:00:00.000Z",
            capabilities: { readFiles: true, runCommands: false },
            trustMode: "persistent",
          },
          target: {
            projectId: "target",
            repoRoot: "/projects/target",
            trustedAt: "2026-01-01T00:00:00.000Z",
            capabilities: { readFiles: true, runCommands: false },
            trustMode: "persistent",
          },
        },
      }),
    );
    const firstReady = join(root, `first-${firstMode}-ready`);
    const releaseFirst = join(root, `release-${firstMode}`);
    const first = spawnLockWorker({
      MODE: firstMode,
      READY_PATH: firstReady,
      RELEASE_PATH: releaseFirst,
      TARGET_PATH: targetPath,
    });
    const firstExit = waitForExit(first);
    await waitForFile(firstReady);

    const second = spawnLockWorker({ MODE: secondMode, TARGET_PATH: targetPath });
    const secondExit = waitForExit(second);
    await waitForPendingLock(lockPath);
    expect(second.exitCode).toBeNull();

    await writeFile(releaseFirst, "release");
    await expect(Promise.all([firstExit, secondExit])).resolves.toEqual([
      { code: 0, stderr: "" },
      { code: 0, stderr: "" },
    ]);

    const persisted = JSON.parse(await readFile(targetPath, "utf8"));
    expect(persisted.projects.unrelated).toMatchObject({ projectId: "unrelated" });
    expect("target" in persisted.projects).toBe(targetRemains);
  });
});
