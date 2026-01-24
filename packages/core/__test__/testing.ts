import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function createStorageTestContext(prefix: string) {
  const testDir = await mkdtemp(join(tmpdir(), `stargazer-test-${prefix}-`));
  await mkdir(join(testDir, "sessions"), { recursive: true });
  await mkdir(join(testDir, "reviews"), { recursive: true });
  await mkdir(join(testDir, "triage-reviews"), { recursive: true });

  const cleanup = async () => {
    await rm(testDir, { recursive: true, force: true });
  };

  return { testDir, cleanup };
}

export function createPathsMock(testDirRef: { testDir: string }) {
  return {
    reviews: join(testDirRef.testDir, "reviews"),
    triageReviews: join(testDirRef.testDir, "triage-reviews"),
    sessions: join(testDirRef.testDir, "sessions"),
    sessionFile: (id: string) => join(testDirRef.testDir, "sessions", `${id}.json`),
    reviewFile: (id: string) => join(testDirRef.testDir, "reviews", `${id}.json`),
    triageReviewFile: (id: string) => join(testDirRef.testDir, "triage-reviews", `${id}.json`),
    config: testDirRef.testDir,
    configFile: join(testDirRef.testDir, "config.json"),
    secretsDir: join(testDirRef.testDir, "secrets"),
    secretsFile: join(testDirRef.testDir, "secrets", "secrets.json"),
    appHome: testDirRef.testDir,
  };
}

export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (result.ok === false) {
    throw new Error(`Expected successful result, got error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
