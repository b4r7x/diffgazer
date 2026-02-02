import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, chmod, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const mocks = vi.hoisted(() => ({ testDir: "" }));

vi.mock("../storage/index.js", async () => {
  const actual = await vi.importActual("../storage/index.js");
  return {
    ...actual,
    get paths() {
      return {
        appHome: mocks.testDir,
        config: mocks.testDir,
        configFile: join(mocks.testDir, "config.json"),
        secretsDir: join(mocks.testDir, "secrets"),
        secretsFile: join(mocks.testDir, "secrets", "secrets.json"),
        sessions: join(mocks.testDir, "sessions"),
        sessionFile: (sessionId: string) => join(mocks.testDir, "sessions", `${sessionId}.json`),
        reviews: join(mocks.testDir, "reviews"),
        reviewFile: (reviewId: string) => join(mocks.testDir, "reviews", `${reviewId}.json`),
        triageReviews: join(mocks.testDir, "triage-reviews"),
        triageReviewFile: (reviewId: string) => join(mocks.testDir, "triage-reviews", `${reviewId}.json`),
      };
    },
  };
});

let getVaultSecret: typeof import("./vault.js").getVaultSecret;
let setVaultSecret: typeof import("./vault.js").setVaultSecret;
let deleteVaultSecret: typeof import("./vault.js").deleteVaultSecret;

describe("Vault Security", () => {
  let secretsDir: string;
  let secretsFile: string;

  beforeEach(async () => {
    const testDir = join(tmpdir(), `vault-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    mocks.testDir = testDir;

    secretsDir = join(testDir, "secrets");
    secretsFile = join(secretsDir, "secrets.json");

    vi.resetModules();
    const vaultMod = await import("./vault.js");
    getVaultSecret = vaultMod.getVaultSecret;
    setVaultSecret = vaultMod.setVaultSecret;
    deleteVaultSecret = vaultMod.deleteVaultSecret;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    try {
      await rm(mocks.testDir, { recursive: true, force: true });
    } catch {}
  });

  function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
    if (!result.ok) throw new Error("Expected ok result");
    return result.value;
  }

  describe("setVaultSecret", () => {
    it("creates secrets directory with 0o700 permissions", async () => {
      unwrap(await setVaultSecret("test_key", "test_value"));

      const stats = await stat(secretsDir);
      expect(stats.isDirectory()).toBe(true);

      // Check directory permissions (0o700 = owner rwx only)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o700);
    });

    it("creates secrets file with 0o600 permissions", async () => {
      unwrap(await setVaultSecret("test_key", "test_value"));

      const stats = await stat(secretsFile);
      expect(stats.isFile()).toBe(true);

      // Check file permissions (0o600 = owner rw only)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("stores secret value correctly", async () => {
      unwrap(await setVaultSecret("api_key", "sk-1234567890"));

      const value = unwrap(await getVaultSecret("api_key"));
      expect(value).toBe("sk-1234567890");
    });

    it("stores multiple secrets", async () => {
      unwrap(await setVaultSecret("key1", "value1"));
      unwrap(await setVaultSecret("key2", "value2"));
      unwrap(await setVaultSecret("key3", "value3"));

      expect(unwrap(await getVaultSecret("key1"))).toBe("value1");
      expect(unwrap(await getVaultSecret("key2"))).toBe("value2");
      expect(unwrap(await getVaultSecret("key3"))).toBe("value3");
    });

    it("overwrites existing secret", async () => {
      unwrap(await setVaultSecret("api_key", "old_value"));
      unwrap(await setVaultSecret("api_key", "new_value"));

      const value = unwrap(await getVaultSecret("api_key"));
      expect(value).toBe("new_value");
    });

    it("handles special characters in secret values", async () => {
      const specialValue = 'secret"with\'quotes\nand\ttabs';
      unwrap(await setVaultSecret("special", specialValue));

      const value = unwrap(await getVaultSecret("special"));
      expect(value).toBe(specialValue);
    });

    it("handles empty string value", async () => {
      unwrap(await setVaultSecret("empty", ""));

      const value = unwrap(await getVaultSecret("empty"));
      expect(value).toBe("");
    });

    it("returns PERMISSION_ERROR when directory creation fails", async () => {
      await mkdir(secretsDir, { recursive: true, mode: 0o700 });
      await chmod(secretsDir, 0o000);

      const result = await setVaultSecret("test_key", "test_value");

      await chmod(secretsDir, 0o700);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("getVaultSecret", () => {
    it("retrieves stored secret", async () => {
      unwrap(await setVaultSecret("test_key", "test_value"));

      const value = unwrap(await getVaultSecret("test_key"));
      expect(value).toBe("test_value");
    });

    it("returns SECRET_NOT_FOUND for missing key", async () => {
      unwrap(await setVaultSecret("existing_key", "value"));

      const result = await getVaultSecret("nonexistent_key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SECRET_NOT_FOUND");
        expect(result.error.message).toContain("nonexistent_key");
      }
    });

    it("returns empty object when secrets file does not exist", async () => {
      const result = await getVaultSecret("any_key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SECRET_NOT_FOUND");
      }
    });

    it("returns PARSE_ERROR for corrupted JSON", async () => {
      await mkdir(secretsDir, { recursive: true, mode: 0o700 });
      await writeFile(secretsFile, "{ invalid json }", { mode: 0o600 });

      const result = await getVaultSecret("test_key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_ERROR");
      }
    });

    it("handles array JSON as empty secrets", async () => {
      await mkdir(secretsDir, { recursive: true, mode: 0o700 });
      await writeFile(secretsFile, JSON.stringify([1, 2, 3]), { mode: 0o600 });

      const result = await getVaultSecret("test_key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SECRET_NOT_FOUND");
      }
    });

    it("returns PERMISSION_ERROR when file cannot be read", async () => {
      await mkdir(secretsDir, { recursive: true, mode: 0o700 });
      await writeFile(secretsFile, JSON.stringify({ key: "value" }), { mode: 0o600 });
      await chmod(secretsFile, 0o000);

      const result = await getVaultSecret("key");

      await chmod(secretsFile, 0o600);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("deleteVaultSecret", () => {
    it("removes secret from vault", async () => {
      unwrap(await setVaultSecret("key1", "value1"));
      unwrap(await setVaultSecret("key2", "value2"));

      unwrap(await deleteVaultSecret("key1"));

      const result = await getVaultSecret("key1");
      expect(result.ok).toBe(false);

      const value2 = unwrap(await getVaultSecret("key2"));
      expect(value2).toBe("value2");
    });

    it("succeeds when deleting nonexistent key", async () => {
      unwrap(await setVaultSecret("existing", "value"));

      const result = await deleteVaultSecret("nonexistent");
      expect(result.ok).toBe(true);
    });

    it("succeeds when secrets file does not exist", async () => {
      const result = await deleteVaultSecret("any_key");
      expect(result.ok).toBe(true);
    });

    it("deletes last secret leaving empty vault", async () => {
      unwrap(await setVaultSecret("only_key", "only_value"));

      unwrap(await deleteVaultSecret("only_key"));

      const result = await getVaultSecret("only_key");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SECRET_NOT_FOUND");
      }
    });

    it("maintains file permissions after deletion", async () => {
      unwrap(await setVaultSecret("key1", "value1"));
      unwrap(await setVaultSecret("key2", "value2"));

      unwrap(await deleteVaultSecret("key1"));

      const stats = await stat(secretsFile);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("returns error when file cannot be written", async () => {
      await mkdir(secretsDir, { recursive: true, mode: 0o700 });
      await writeFile(secretsFile, JSON.stringify({ key: "value" }), { mode: 0o600 });
      await chmod(secretsDir, 0o500);

      const result = await deleteVaultSecret("key");

      await chmod(secretsDir, 0o700);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("multiple operations", () => {
    it("handles multiple sequential writes", async () => {
      for (let i = 0; i < 10; i++) {
        const result = await setVaultSecret(`key${i}`, `value${i}`);
        expect(result.ok).toBe(true);
      }

      for (let i = 0; i < 10; i++) {
        const value = unwrap(await getVaultSecret(`key${i}`));
        expect(value).toBe(`value${i}`);
      }
    });

    it("handles mixed operations sequentially", async () => {
      unwrap(await setVaultSecret("key1", "value1"));
      unwrap(await setVaultSecret("key2", "value2"));

      const read1 = unwrap(await getVaultSecret("key1"));
      expect(read1).toBe("value1");

      unwrap(await deleteVaultSecret("key1"));

      const result = await getVaultSecret("key1");
      expect(result.ok).toBe(false);

      const read2 = unwrap(await getVaultSecret("key2"));
      expect(read2).toBe("value2");
    });
  });

  describe("data integrity", () => {
    it("preserves exact secret values across write/read cycle", async () => {
      const testValues = [
        "simple",
        "with spaces",
        "with\nnewlines",
        "with\ttabs",
        'with"quotes"',
        "with'apostrophes'",
        "with\\backslashes",
        "unicode: 你好",
        "",
        " ",
        "  leading/trailing  ",
      ];

      for (const value of testValues) {
        unwrap(await setVaultSecret("test", value));
        const retrieved = unwrap(await getVaultSecret("test"));
        expect(retrieved).toBe(value);
      }
    });

    it("maintains JSON structure after multiple operations", async () => {
      unwrap(await setVaultSecret("a", "1"));
      unwrap(await setVaultSecret("b", "2"));
      unwrap(await setVaultSecret("c", "3"));
      unwrap(await deleteVaultSecret("b"));
      unwrap(await setVaultSecret("d", "4"));

      expect(unwrap(await getVaultSecret("a"))).toBe("1");
      expect(unwrap(await getVaultSecret("c"))).toBe("3");
      expect(unwrap(await getVaultSecret("d"))).toBe("4");

      const resultB = await getVaultSecret("b");
      expect(resultB.ok).toBe(false);
    });
  });
});
