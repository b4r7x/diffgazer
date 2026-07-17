import { beforeEach, describe, expect, it, vi } from "vitest";

// Track the last password set, so availability check's write/read roundtrip succeeds
let lastSetPassword: string | null = null;
const mockGetPassword = vi.fn(() => lastSetPassword);
const mockSetPassword = vi.fn((value: string) => {
  lastSetPassword = value;
});
const mockDeletePassword = vi.fn();

const { mockLog, mockRequireModule } = vi.hoisted(() => ({
  mockLog: vi.fn(),
  mockRequireModule: vi.fn(),
}));

// Boundary mock: node:module.createRequire is used to dynamically load the @napi-rs/keyring native addon (the OS keychain boundary); tests inject a fake Entry to simulate available/unavailable native module.
vi.mock("node:module", () => ({
  createRequire: vi.fn(() => mockRequireModule),
}));

vi.mock("../log.js", () => ({ log: mockLog }));

function setupKeyringAvailable() {
  lastSetPassword = null;
  mockGetPassword.mockImplementation(() => lastSetPassword);
  mockSetPassword.mockImplementation((value: string) => {
    lastSetPassword = value;
  });
  mockDeletePassword.mockReturnValue(undefined);

  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = mockSetPassword;
    deletePassword = mockDeletePassword;
  }

  mockRequireModule.mockReturnValue({ Entry: MockEntry });
}

function setupKeyringUnavailable() {
  mockRequireModule.mockImplementation(() => {
    throw new Error("Cannot find module '@napi-rs/keyring'");
  });
}

describe("keyring (available)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    lastSetPassword = null;
    setupKeyringAvailable();
  });

  it("reports availability when the native module loads and a roundtrip succeeds", async () => {
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(isKeyringAvailable()).toBe(true);
  });

  it("reports unavailable without cleanup when constructing the probe entry fails", async () => {
    const deletePassword = vi.fn();

    class ThrowingEntry {
      constructor() {
        throw new Error("keyring constructor failed");
      }

      getPassword() {
        return null;
      }

      setPassword() {}

      deletePassword() {
        deletePassword();
      }
    }

    mockRequireModule.mockReturnValue({ Entry: ThrowingEntry });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(isKeyringAvailable()).toBe(false);
    expect(deletePassword).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith("warn", "keyring_availability_check_failed", {
      error: "keyring constructor failed",
    });
  });

  it("isolates interleaved availability probes and cleans up only their own accounts", async () => {
    const passwords = new Map<string, string>();
    const createdAccounts: string[] = [];
    const deletedAccounts: string[] = [];
    let runInterleavedProbe: (() => void) | null = null;
    let hasInterleaved = false;

    class InterleavedEntry {
      constructor(
        _service: string,
        private readonly account: string,
      ) {
        createdAccounts.push(account);
      }

      setPassword(value: string) {
        passwords.set(this.account, value);
        if (!hasInterleaved && runInterleavedProbe) {
          hasInterleaved = true;
          runInterleavedProbe();
        }
      }

      getPassword() {
        return passwords.get(this.account) ?? null;
      }

      deletePassword() {
        deletedAccounts.push(this.account);
        passwords.delete(this.account);
      }
    }

    mockRequireModule.mockReturnValue({ Entry: InterleavedEntry });
    const firstInstance = await import("./keyring.js");
    vi.resetModules();
    const secondInstance = await import("./keyring.js");
    let secondAvailable: boolean | null = null;
    runInterleavedProbe = () => {
      secondAvailable = secondInstance.isKeyringAvailable();
    };

    expect(firstInstance.isKeyringAvailable()).toBe(true);
    expect(secondAvailable).toBe(true);
    expect(new Set(createdAccounts).size).toBe(2);
    expect(deletedAccounts).toEqual(expect.arrayContaining(createdAccounts));
    expect(passwords).toEqual(new Map());
  });

  it("returns the stored password from readKeyringSecret", async () => {
    const { isKeyringAvailable, readKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable(); // prime availability cache
    mockGetPassword.mockReturnValue("my-secret");

    const result = readKeyringSecret("api-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("my-secret");
    }
  });

  it("persists a value through writeKeyringSecret", async () => {
    const { isKeyringAvailable, writeKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockSetPassword.mockReturnValue(undefined);

    const result = writeKeyringSecret("api-key", "secret-value");

    expect(result.ok).toBe(true);
  });

  it("reports that a deletion happened when the key previously existed", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockGetPassword.mockReturnValue("existing-value");
    mockDeletePassword.mockReturnValue(undefined);

    const result = deleteKeyringSecret("api-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it("reports that no deletion happened when the key was already absent", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockGetPassword.mockReturnValue(null);

    const result = deleteKeyringSecret("nonexistent-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });

  it.each([
    {
      operation: "read",
      throwingMock: () => {
        mockGetPassword.mockImplementation(() => {
          throw new Error("access denied");
        });
      },
      run: async () => {
        const { readKeyringSecret } = await import("./keyring.js");
        return readKeyringSecret("api-key");
      },
      expectedCode: "KEYRING_READ_FAILED" as const,
    },
    {
      operation: "write",
      throwingMock: () => {
        mockSetPassword.mockImplementation(() => {
          throw new Error("permission denied");
        });
      },
      run: async () => {
        const { writeKeyringSecret } = await import("./keyring.js");
        return writeKeyringSecret("api-key", "value");
      },
      expectedCode: "KEYRING_WRITE_FAILED" as const,
    },
  ])("surfaces $expectedCode when the underlying $operation throws", async ({
    throwingMock,
    run,
    expectedCode,
  }) => {
    const { isKeyringAvailable } = await import("./keyring.js");
    isKeyringAvailable(); // prime availability cache
    throwingMock();

    const result = await run();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(expectedCode);
    }
  });
});

describe("keyring (unavailable)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupKeyringUnavailable();
  });

  it("reports unavailable when the native module fails to load", async () => {
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(isKeyringAvailable()).toBe(false);
  });

  it.each([
    {
      operation: "read",
      run: async () => {
        const { readKeyringSecret } = await import("./keyring.js");
        return readKeyringSecret("test-key");
      },
    },
    {
      operation: "write",
      run: async () => {
        const { writeKeyringSecret } = await import("./keyring.js");
        return writeKeyringSecret("test-key", "value");
      },
    },
    {
      operation: "delete",
      run: async () => {
        const { deleteKeyringSecret } = await import("./keyring.js");
        return deleteKeyringSecret("test-key");
      },
    },
  ])("returns KEYRING_UNAVAILABLE from $operation", async ({ run }) => {
    const result = await run();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    }
  });
});
