import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSecret, setSecret, deleteSecret, isKeyringAvailable } from "./keyring.js";
import { createErrnoException } from "../__test__/testing.js";

const mockEntry = {
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
};

class MockEntry {
  constructor(service: string, key: string) {
    MockEntry.lastCall = { service, key };
  }
  static lastCall: { service: string; key: string } | null = null;
  static calls: Array<{ service: string; key: string }> = [];

  getPassword = mockEntry.getPassword;
  setPassword = mockEntry.setPassword;
  deletePassword = mockEntry.deletePassword;
}

vi.mock("@napi-rs/keyring", () => ({
  Entry: class Entry {
    constructor(service: string, key: string) {
      MockEntry.calls.push({ service, key });
      return new MockEntry(service, key);
    }
  },
}));

describe("keyring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEntry.calls = [];
    MockEntry.lastCall = null;
  });

  describe("getSecret", () => {
    it("returns secret value when found", async () => {
      mockEntry.getPassword.mockReturnValueOnce("my-api-key");

      const result = await getSecret("test-key");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("my-api-key");
      }
      expect(MockEntry.lastCall).toEqual({ service: "stargazer", key: "test-key" });
    });

    it("returns SECRET_NOT_FOUND when secret does not exist", async () => {
      mockEntry.getPassword.mockReturnValueOnce(null);

      const result = await getSecret("missing-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SECRET_NOT_FOUND");
        expect(result.error.message).toContain("missing-key");
      }
    });

    it("returns READ_FAILED on keyring read error", async () => {
      mockEntry.getPassword.mockImplementationOnce(() => {
        throw new Error("Keychain access denied");
      });

      const result = await getSecret("test-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("READ_FAILED");
        expect(result.error.message).toContain("Failed to read secret 'test-key'");
        expect(result.error.details).toBe("Keychain access denied");
      }
    });

    it("returns PERMISSION_ERROR on EACCES error", async () => {
      const eaccesError = createErrnoException("Permission denied", "EACCES");
      mockEntry.getPassword.mockImplementationOnce(() => {
        throw eaccesError;
      });

      const result = await getSecret("test-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("setSecret", () => {
    it("stores secret successfully", async () => {
      mockEntry.setPassword.mockReturnValueOnce(undefined);

      const result = await setSecret("api-key", "secret-value");

      expect(result.ok).toBe(true);
      expect(MockEntry.lastCall).toEqual({ service: "stargazer", key: "api-key" });
      expect(mockEntry.setPassword).toHaveBeenCalledWith("secret-value");
    });

    it("returns WRITE_FAILED on keyring write error", async () => {
      mockEntry.setPassword.mockImplementationOnce(() => {
        throw new Error("Keychain locked");
      });

      const result = await setSecret("api-key", "secret-value");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WRITE_FAILED");
        expect(result.error.message).toContain("Failed to store secret 'api-key'");
        expect(result.error.details).toBe("Keychain locked");
      }
    });

    it("returns PERMISSION_ERROR on EACCES during write", async () => {
      const eaccesError = createErrnoException("Access denied", "EACCES");
      mockEntry.setPassword.mockImplementationOnce(() => {
        throw eaccesError;
      });

      const result = await setSecret("api-key", "secret-value");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("deleteSecret", () => {
    it("deletes secret successfully", async () => {
      mockEntry.deletePassword.mockReturnValueOnce(undefined);

      const result = await deleteSecret("api-key");

      expect(result.ok).toBe(true);
      expect(MockEntry.lastCall).toEqual({ service: "stargazer", key: "api-key" });
      expect(mockEntry.deletePassword).toHaveBeenCalled();
    });

    it("succeeds when secret not found (idempotent delete)", async () => {
      const notFoundError = new Error("Secret not found");
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw notFoundError;
      });

      const result = await deleteSecret("missing-key");

      expect(result.ok).toBe(true);
    });

    it("succeeds when ENOENT error (file not found)", async () => {
      const enoentError = createErrnoException("No such file", "ENOENT");
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw enoentError;
      });

      const result = await deleteSecret("missing-key");

      expect(result.ok).toBe(true);
    });

    it("succeeds when error message contains 'does not exist'", async () => {
      const notExistError = new Error("Password does not exist");
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw notExistError;
      });

      const result = await deleteSecret("missing-key");

      expect(result.ok).toBe(true);
    });

    it("returns WRITE_FAILED on non-notfound error", async () => {
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw new Error("Keychain locked");
      });

      const result = await deleteSecret("api-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("WRITE_FAILED");
        expect(result.error.message).toContain("Failed to delete secret 'api-key'");
      }
    });

    it("returns PERMISSION_ERROR on EACCES during delete", async () => {
      const eaccesError = createErrnoException("Access denied", "EACCES");
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw eaccesError;
      });

      const result = await deleteSecret("api-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PERMISSION_ERROR");
      }
    });
  });

  describe("isKeyringAvailable", () => {
    it("returns true when keyring works correctly", async () => {
      mockEntry.setPassword.mockReturnValueOnce(undefined);
      mockEntry.getPassword.mockImplementationOnce(() => {
        return mockEntry.setPassword.mock.calls[0]?.[0] ?? null;
      });
      mockEntry.deletePassword.mockReturnValueOnce(undefined);

      const available = await isKeyringAvailable();

      expect(available).toBe(true);
      expect(mockEntry.setPassword).toHaveBeenCalled();
      expect(mockEntry.getPassword).toHaveBeenCalled();
      expect(mockEntry.deletePassword).toHaveBeenCalled();
    });

    it("returns false when set fails", async () => {
      mockEntry.setPassword.mockImplementationOnce(() => {
        throw new Error("Keychain unavailable");
      });

      const available = await isKeyringAvailable();

      expect(available).toBe(false);
    });

    it("returns false when get fails", async () => {
      mockEntry.setPassword.mockReturnValueOnce(undefined);
      mockEntry.getPassword.mockImplementationOnce(() => {
        throw new Error("Keychain unavailable");
      });

      const available = await isKeyringAvailable();

      expect(available).toBe(false);
    });

    it("returns false when value mismatch", async () => {
      mockEntry.setPassword.mockReturnValueOnce(undefined);
      mockEntry.getPassword.mockReturnValueOnce("wrong-value");

      const available = await isKeyringAvailable();

      expect(available).toBe(false);
    });

    it("cleans up test key even on cleanup error", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockEntry.setPassword.mockReturnValueOnce(undefined);
      mockEntry.getPassword.mockImplementationOnce(() => {
        return mockEntry.setPassword.mock.calls[0]?.[0] ?? null;
      });
      mockEntry.deletePassword.mockImplementationOnce(() => {
        throw new Error("Cleanup failed");
      });

      const available = await isKeyringAvailable();

      expect(available).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[keyring] Failed to clean up test key")
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("error handling patterns", () => {
    it("handles different not-found error messages", async () => {
      const notFoundCases = [
        new Error("not found"),
        new Error("No such entry"),
        new Error("Item does not exist"),
      ];

      for (const error of notFoundCases) {
        vi.clearAllMocks();
        mockEntry.deletePassword.mockImplementationOnce(() => {
          throw error;
        });

        const result = await deleteSecret("test");
        expect(result.ok).toBe(true);
      }
    });

    it("preserves error context in Result type", async () => {
      const originalError = new Error("Keychain database corrupted");
      mockEntry.getPassword.mockImplementationOnce(() => {
        throw originalError;
      });

      const result = await getSecret("test-key");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("READ_FAILED");
        expect(result.error.details).toBe("Keychain database corrupted");
        expect(result.error.message).toBe("Failed to read secret 'test-key'");
      }
    });

    it("uses correct APP_NAME for all operations", async () => {
      mockEntry.getPassword.mockReturnValueOnce("value");
      await getSecret("key1");

      mockEntry.setPassword.mockReturnValueOnce(undefined);
      await setSecret("key2", "value");

      mockEntry.deletePassword.mockReturnValueOnce(undefined);
      await deleteSecret("key3");

      expect(MockEntry.calls[0]).toEqual({ service: "stargazer", key: "key1" });
      expect(MockEntry.calls[1]).toEqual({ service: "stargazer", key: "key2" });
      expect(MockEntry.calls[2]).toEqual({ service: "stargazer", key: "key3" });
    });
  });
});
