import { describe, it, expect } from "vitest";
import {
  isKeyringAvailable,
  readKeyringSecret,
  writeKeyringSecret,
  deleteKeyringSecret,
} from "./keyring.js";

// The keyring module uses createRequire to load @napi-rs/keyring.
// In CI/test environments where keyring is not available, all operations
// return KEYRING_UNAVAILABLE. On systems with keyring, operations work.
// We test both paths based on actual availability.

const keyringAvailable = isKeyringAvailable();

describe("readKeyringSecret", () => {
  if (keyringAvailable) {
    it("should return Result with null for non-existent key", () => {
      const result = readKeyringSecret("__stargazer_test_nonexistent__");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBeNull();
    });
  } else {
    it("should return KEYRING_UNAVAILABLE error when keyring is not available", () => {
      const result = readKeyringSecret("test-key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    });
  }
});

describe("writeKeyringSecret", () => {
  if (keyringAvailable) {
    it("should write and read back a secret", () => {
      const testKey = "__stargazer_test_write__";
      const writeResult = writeKeyringSecret(testKey, "test-value");
      expect(writeResult.ok).toBe(true);

      const readResult = readKeyringSecret(testKey);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.value).toBe("test-value");

      // Clean up
      deleteKeyringSecret(testKey);
    });
  } else {
    it("should return KEYRING_UNAVAILABLE error when keyring is not available", () => {
      const result = writeKeyringSecret("test-key", "value");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    });
  }
});

describe("deleteKeyringSecret", () => {
  if (keyringAvailable) {
    it("should return false for non-existent key", () => {
      const result = deleteKeyringSecret("__stargazer_test_nonexistent__");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(false);
    });

    it("should delete an existing key and return true", () => {
      const testKey = "__stargazer_test_delete__";
      writeKeyringSecret(testKey, "to-delete");

      const result = deleteKeyringSecret(testKey);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe(true);

      // Verify it's gone
      const readResult = readKeyringSecret(testKey);
      expect(readResult.ok).toBe(true);
      if (readResult.ok) expect(readResult.value).toBeNull();
    });
  } else {
    it("should return KEYRING_UNAVAILABLE error when keyring is not available", () => {
      const result = deleteKeyringSecret("test-key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    });
  }
});
