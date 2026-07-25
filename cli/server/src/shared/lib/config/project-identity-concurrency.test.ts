import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONCURRENCY_TEST_TIMEOUT_MS = 20_000;
const storeModuleUrl = new URL("./store.ts", import.meta.url).href;

const projectIdentityWorker = `
import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const { createConfigStore } = await import(process.env.STORE_MODULE_URL);
const store = createConfigStore();
await writeFile(process.env.READY_PATH, "ready");
while (true) {
  try {
    await access(process.env.START_PATH);
    break;
  } catch {
    await delay(2);
  }
}
const project = store.ensureProjectFile(process.env.PROJECT_ROOT);
await writeFile(process.env.RESULT_PATH, JSON.stringify(project));
`;

let diffgazerHome: string;
let projectRootA: string;

async function loadStore() {
  const { getStore } = await import("./store.js");
  return getStore();
}

function trustForProject(projectId: string, repoRoot: string) {
  return {
    projectId,
    repoRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent" as const,
  };
}

async function waitForPaths(filePaths: string[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (true) {
    try {
      await Promise.all(filePaths.map((filePath) => access(filePath)));
      return;
    } catch {
      if (Date.now() >= deadline) throw new Error("Timed out waiting for project identity workers");
      await delay(10);
    }
  }
}

function waitForExit(child: ChildProcess): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  });
}

function readProjectId(filePath: string): string {
  const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (
    typeof value !== "object" ||
    value === null ||
    !("projectId" in value) ||
    typeof value.projectId !== "string"
  ) {
    throw new Error(`Expected project identity in ${filePath}`);
  }
  return value.projectId;
}

describe("project identity concurrency", () => {
  beforeEach(() => {
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-project-identity-home-"));
    projectRootA = mkdtempSync(join(tmpdir(), "diffgazer-project-identity-proj-"));
    mkdirSync(join(projectRootA, ".git"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DIFFGAZER_HOME;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    rmSync(diffgazerHome, { recursive: true, force: true });
    rmSync(projectRootA, { recursive: true, force: true });
  });

  it(
    "concurrent project initializers return the same durable identity",
    async () => {
      const barrierRoot = join(diffgazerHome, "project-identity-race");
      mkdirSync(barrierRoot);
      const startPath = join(barrierRoot, "start");
      const workerIds = ["a", "b"] as const;
      const children = workerIds.map((workerId) =>
        spawn(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "--eval", projectIdentityWorker],
          {
            env: {
              ...process.env,
              PROJECT_ROOT: projectRootA,
              READY_PATH: join(barrierRoot, `${workerId}.ready`),
              RESULT_PATH: join(barrierRoot, `${workerId}.json`),
              START_PATH: startPath,
              STORE_MODULE_URL: storeModuleUrl,
            },
            stdio: ["ignore", "ignore", "pipe"],
          },
        ),
      );
      const exits = children.map(waitForExit);

      try {
        await waitForPaths(workerIds.map((workerId) => join(barrierRoot, `${workerId}.ready`)));
        await writeFile(startPath, "start");
        await expect(Promise.all(exits)).resolves.toEqual([
          { code: 0, stderr: "" },
          { code: 0, stderr: "" },
        ]);

        const callerIds = workerIds.map((workerId) =>
          readProjectId(join(barrierRoot, `${workerId}.json`)),
        );
        const durableId = readProjectId(join(projectRootA, ".diffgazer/project.json"));
        const [callerA, callerB] = callerIds;
        if (!callerA || !callerB) throw new Error("Expected two project identity results");

        expect(new Set(callerIds)).toEqual(new Set([durableId]));
        const store = await loadStore();
        await store.saveTrust(trustForProject(callerA, projectRootA));
        expect(store.getTrust(callerB)?.projectId).toBe(durableId);
      } finally {
        for (const child of children) {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }
        await Promise.allSettled(exits);
      }
    },
    CONCURRENCY_TEST_TIMEOUT_MS,
  );
});
