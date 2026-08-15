import { beforeEach, describe, expect, it, vi } from "vitest";

// Track the last password set, so availability check's write/read roundtrip succeeds
let lastSetPassword: string | null = null;
const mockGetPassword = vi.fn(() => lastSetPassword);
const mockSetPassword = vi.fn((value: string) => {
  lastSetPassword = value;
});
const mockDeletePassword = vi.fn();

const errorSentinels = {
  module: {
    keyId: "module-key-id-sentinel",
    backend: "module-backend-error-sentinel",
    path: "/private/keyring/module-path-sentinel",
    secret: "module-secret-sentinel",
    stack: "module-stack-sentinel",
    cause: "module-cause-sentinel",
  },
  probe: {
    keyId: "probe-key-id-sentinel",
    backend: "probe-backend-error-sentinel",
    path: "/private/keyring/probe-path-sentinel",
    secret: "probe-secret-sentinel",
    stack: "probe-stack-sentinel",
    cause: "probe-cause-sentinel",
  },
  cleanup: {
    keyId: "cleanup-key-id-sentinel",
    backend: "cleanup-backend-error-sentinel",
    path: "/private/keyring/cleanup-path-sentinel",
    secret: "cleanup-secret-sentinel",
    stack: "cleanup-stack-sentinel",
    cause: "cleanup-cause-sentinel",
  },
  read: {
    keyId: "read-key-id-sentinel",
    backend: "read-backend-error-sentinel",
    path: "/private/keyring/read-path-sentinel",
    secret: "read-secret-sentinel",
    stack: "read-stack-sentinel",
    cause: "read-cause-sentinel",
  },
  write: {
    keyId: "write-key-id-sentinel",
    backend: "write-backend-error-sentinel",
    path: "/private/keyring/write-path-sentinel",
    secret: "write-secret-sentinel",
    stack: "write-stack-sentinel",
    cause: "write-cause-sentinel",
  },
  delete: {
    keyId: "delete-key-id-sentinel",
    backend: "delete-backend-error-sentinel",
    path: "/private/keyring/delete-path-sentinel",
    secret: "delete-secret-sentinel",
    stack: "delete-stack-sentinel",
    cause: "delete-cause-sentinel",
  },
} as const;
const absentReadKeyId = "absent-read-key-id-sentinel";

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
  mockDeletePassword.mockReturnValue(true);

  class MockEntry {
    getPassword = mockGetPassword;
    setPassword = mockSetPassword;
    deleteCredential = mockDeletePassword;
  }

  class MockAsyncEntry {
    getPassword = vi.fn(async () => mockGetPassword());
    setPassword = vi.fn(async (value: string) => {
      mockSetPassword(value);
    });
    deleteCredential = vi.fn(async () => {
      return mockDeletePassword();
    });
  }

  mockRequireModule.mockReturnValue({ Entry: MockEntry, AsyncEntry: MockAsyncEntry });
}

function setupKeyringUnavailable() {
  mockRequireModule.mockImplementation(() => {
    throw createSecretBearingError("module");
  });
}

function collectStrings(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object" || seen.has(value)) return [];

  seen.add(value);
  const strings: string[] = [];
  if (value instanceof Error) {
    strings.push(value.name, value.message);
    if (value.stack) strings.push(value.stack);
  }

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && "value" in descriptor)
      strings.push(...collectStrings(descriptor.value, seen));
  }
  return strings;
}

function createSecretBearingError(boundary: keyof typeof errorSentinels): Error {
  const sentinels = errorSentinels[boundary];
  const error = new Error(
    `${sentinels.backend} key=${sentinels.keyId} path=${sentinels.path} secret=${sentinels.secret}`,
  );
  Object.defineProperty(error, "stack", { value: sentinels.stack, configurable: true });
  Object.defineProperty(error, "cause", {
    value: { cause: sentinels.cause, secret: sentinels.secret },
    enumerable: false,
  });
  const diagnostics: { path: string; secret: string; cycle?: unknown } = {
    path: sentinels.path,
    secret: sentinels.secret,
  };
  diagnostics.cycle = diagnostics;
  Object.defineProperty(error, "diagnostics", {
    value: diagnostics,
    enumerable: false,
  });
  return error;
}

function expectLogsOmitSentinels(): void {
  const loggedStrings = collectStrings(mockLog.mock.calls);
  for (const sentinel of Object.values(errorSentinels).flatMap((boundary) =>
    Object.values(boundary),
  )) {
    expect(loggedStrings.some((value) => value.includes(sentinel))).toBe(false);
  }
}

function expectMessageOmitsSentinels(message: string): void {
  const sentinels = Object.values(errorSentinels).flatMap((boundary) => Object.values(boundary));
  for (const sentinel of sentinels) expect(message.includes(sentinel)).toBe(false);
}

function expectNoErrorDetails(value: object): void {
  expect(Object.hasOwn(value, "stack")).toBe(false);
  expect(Object.hasOwn(value, "cause")).toBe(false);
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

    expect(await isKeyringAvailable()).toBe(true);
  });

  it("reports unavailable without cleanup when constructing the probe entry fails", async () => {
    const deletePassword = vi.fn();

    class ThrowingEntry {
      constructor() {
        throw createSecretBearingError("probe");
      }

      getPassword() {
        return null;
      }

      setPassword() {}

      deleteCredential() {
        deletePassword();
      }
    }

    mockRequireModule.mockReturnValue({ Entry: ThrowingEntry, AsyncEntry: ThrowingEntry });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(false);
    expect(deletePassword).not.toHaveBeenCalled();
    expect(mockLog.mock.calls).toEqual([
      [
        "warn",
        "keyring_availability_check_failed",
        { code: "KEYRING_UNAVAILABLE", operation: "probe" },
      ],
    ]);
    expectLogsOmitSentinels();
  });

  it("logs cleanup failure separately from a successful probe", async () => {
    class CleanupFailingEntry {
      getPassword = vi.fn(async () => mockGetPassword());
      setPassword = vi.fn(async (value: string) => {
        mockSetPassword(value);
      });
      deleteCredential = vi.fn(async () => {
        throw createSecretBearingError("cleanup");
      });
    }
    mockRequireModule.mockReturnValue({
      Entry: CleanupFailingEntry,
      AsyncEntry: CleanupFailingEntry,
    });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(true);
    expect(mockLog.mock.calls).toEqual([
      [
        "warn",
        "keyring_test_key_cleanup_failed",
        { code: "KEYRING_DELETE_FAILED", operation: "delete" },
      ],
    ]);
    expectLogsOmitSentinels();
  });

  it("logs cleanup failure when credential deletion returns false", async () => {
    class CleanupFalseEntry {
      getPassword = vi.fn(async () => mockGetPassword());
      setPassword = vi.fn(async (value: string) => {
        mockSetPassword(value);
      });
      deleteCredential = vi.fn(async () => false);
    }
    mockRequireModule.mockReturnValue({ Entry: CleanupFalseEntry, AsyncEntry: CleanupFalseEntry });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(true);
    expect(mockLog.mock.calls).toEqual([
      [
        "warn",
        "keyring_test_key_cleanup_failed",
        { code: "KEYRING_DELETE_FAILED", operation: "delete" },
      ],
    ]);
    expectLogsOmitSentinels();
  });

  it("logs a readback mismatch once and caches the unavailable result", async () => {
    class MismatchingEntry {
      setPassword = vi.fn(async (value: string) => {
        mockSetPassword(value);
      });
      getPassword = vi.fn(async () => "different-value");
      deleteCredential = vi.fn(async () => {
        return mockDeletePassword();
      });
    }
    mockRequireModule.mockReturnValue({ Entry: MismatchingEntry, AsyncEntry: MismatchingEntry });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(false);
    expect(await isKeyringAvailable()).toBe(false);
    expect(mockLog.mock.calls).toEqual([
      [
        "warn",
        "keyring_availability_check_failed",
        { code: "KEYRING_UNAVAILABLE", operation: "probe" },
      ],
    ]);
    expectLogsOmitSentinels();
  });

  it("keeps probe mismatch and cleanup failures as separate events", async () => {
    class MismatchCleanupFailingEntry {
      setPassword = vi.fn(async (value: string) => {
        mockSetPassword(value);
      });
      getPassword = vi.fn(async () => "different-value");
      deleteCredential = vi.fn(async () => {
        throw createSecretBearingError("cleanup");
      });
    }
    mockRequireModule.mockReturnValue({
      Entry: MismatchCleanupFailingEntry,
      AsyncEntry: MismatchCleanupFailingEntry,
    });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(false);
    expect(await isKeyringAvailable()).toBe(false);
    expect(mockLog.mock.calls).toEqual([
      [
        "warn",
        "keyring_availability_check_failed",
        { code: "KEYRING_UNAVAILABLE", operation: "probe" },
      ],
      [
        "warn",
        "keyring_test_key_cleanup_failed",
        { code: "KEYRING_DELETE_FAILED", operation: "delete" },
      ],
    ]);
    expectLogsOmitSentinels();
  });

  it("probes an unavailable keyring once per process and re-probes only on refresh", async () => {
    let probeSucceeds = false;
    class ProbeEntry {
      getPassword = vi.fn(async () => (probeSucceeds ? lastSetPassword : null));
      setPassword = vi.fn(async (value: string) => {
        mockSetPassword(value);
      });
      deleteCredential = vi.fn(async () => {
        return mockDeletePassword();
      });
    }
    mockRequireModule.mockReturnValue({ Entry: ProbeEntry, AsyncEntry: ProbeEntry });
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(await isKeyringAvailable()).toBe(false);
    const probeWrites = mockSetPassword.mock.calls.length;

    // A locked keychain must not be re-probed (another unlock prompt) per call.
    expect(await isKeyringAvailable()).toBe(false);
    expect(mockSetPassword.mock.calls.length).toBe(probeWrites);

    probeSucceeds = true;
    expect(await isKeyringAvailable()).toBe(false);
    expect(await isKeyringAvailable({ refresh: true })).toBe(true);
    expect(mockSetPassword.mock.calls.length).toBeGreaterThan(probeWrites);
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

      deleteCredential() {
        deletedAccounts.push(this.account);
        passwords.delete(this.account);
      }
    }

    class InterleavedAsyncEntry {
      constructor(
        _service: string,
        private readonly account: string,
      ) {
        createdAccounts.push(account);
      }

      async setPassword(value: string) {
        passwords.set(this.account, value);
        if (!hasInterleaved && runInterleavedProbe) {
          hasInterleaved = true;
          runInterleavedProbe();
        }
      }

      async getPassword() {
        return passwords.get(this.account) ?? null;
      }

      async deleteCredential() {
        deletedAccounts.push(this.account);
        passwords.delete(this.account);
      }
    }

    mockRequireModule.mockReturnValue({
      Entry: InterleavedEntry,
      AsyncEntry: InterleavedAsyncEntry,
    });
    const firstInstance = await import("./keyring.js");
    vi.resetModules();
    const secondInstance = await import("./keyring.js");
    let secondAvailable: boolean | null = null;
    runInterleavedProbe = () => {
      void secondInstance.isKeyringAvailable().then((available) => {
        secondAvailable = available;
      });
    };

    expect(await firstInstance.isKeyringAvailable()).toBe(true);
    await vi.waitFor(() => {
      expect(secondAvailable).toBe(true);
    });
    expect(new Set(createdAccounts).size).toBe(2);
    expect(deletedAccounts).toEqual(expect.arrayContaining(createdAccounts));
    expect(passwords).toEqual(new Map());
  });

  it("returns the stored password from readKeyringSecret", async () => {
    const { isKeyringAvailable, readKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable(); // prime availability cache
    mockGetPassword.mockReturnValue("my-secret");

    const result = await readKeyringSecret("api-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("my-secret");
    }
  });

  it("returns null for an absent secret without logging", async () => {
    const { isKeyringAvailable, readKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable();
    mockLog.mockClear();
    mockGetPassword.mockReturnValue(null);

    const result = await readKeyringSecret(absentReadKeyId);

    expect(result).toEqual({ ok: true, value: null });
    expect(mockLog.mock.calls).toEqual([]);
  });

  it("persists a value through writeKeyringSecret", async () => {
    const { isKeyringAvailable, writeKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable();
    mockSetPassword.mockClear();
    mockDeletePassword.mockClear();

    const result = await writeKeyringSecret("api-key", "secret-value");

    expect(result.ok).toBe(true);
    expect(mockSetPassword).toHaveBeenCalledWith("secret-value");
  });

  it("reports that a deletion happened when the key previously existed", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable();
    mockSetPassword.mockClear();
    mockDeletePassword.mockClear();
    mockGetPassword.mockReturnValue("existing-value");

    const result = await deleteKeyringSecret("api-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
    expect(mockDeletePassword).toHaveBeenCalledTimes(1);
  });

  it("reports that no deletion happened when the key was already absent", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable();
    mockSetPassword.mockClear();
    mockDeletePassword.mockClear();
    mockGetPassword.mockReturnValue(null);

    const result = await deleteKeyringSecret("nonexistent-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
    expect(mockDeletePassword).not.toHaveBeenCalled();
  });

  it("returns KEYRING_DELETE_FAILED when credential deletion returns false", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    await isKeyringAvailable();
    mockGetPassword.mockReturnValue("existing-value");
    mockDeletePassword.mockReturnValue(false);

    const result = await deleteKeyringSecret(errorSentinels.delete.keyId);

    expect(result).toEqual({
      ok: false,
      error: {
        code: "KEYRING_DELETE_FAILED",
        message: "Failed to delete secret from keyring",
        details: undefined,
      },
    });
    if (!result.ok) {
      expectNoErrorDetails(result.error);
      expectMessageOmitsSentinels(result.error.message);
    }
    expect(mockLog.mock.calls).toEqual([
      ["warn", "keyring_delete_failed", { code: "KEYRING_DELETE_FAILED", operation: "delete" }],
    ]);
    expectLogsOmitSentinels();
  });

  it.each([
    {
      operation: "read",
      throwingMock: () => {
        mockGetPassword.mockImplementation(() => {
          throw createSecretBearingError("read");
        });
      },
      run: async () => {
        const { readKeyringSecret } = await import("./keyring.js");
        return readKeyringSecret(errorSentinels.read.keyId);
      },
      expectedCode: "KEYRING_READ_FAILED" as const,
      expectedMessage: "Failed to read secret from keyring",
      expectedLogEvent: "keyring_read_failed",
    },
    {
      operation: "write",
      throwingMock: () => {
        mockSetPassword.mockImplementation(() => {
          throw createSecretBearingError("write");
        });
      },
      run: async () => {
        const { writeKeyringSecret } = await import("./keyring.js");
        return writeKeyringSecret(errorSentinels.write.keyId, errorSentinels.write.secret);
      },
      expectedCode: "KEYRING_WRITE_FAILED" as const,
      expectedMessage: "Failed to store secret in keyring",
      expectedLogEvent: "keyring_write_failed",
    },
    {
      operation: "delete",
      throwingMock: () => {
        mockGetPassword.mockReturnValue("existing-value");
        mockDeletePassword.mockClear();
        mockDeletePassword.mockImplementation(() => {
          throw createSecretBearingError("delete");
        });
      },
      run: async () => {
        const { deleteKeyringSecret } = await import("./keyring.js");
        return deleteKeyringSecret(errorSentinels.delete.keyId);
      },
      expectedCode: "KEYRING_DELETE_FAILED" as const,
      expectedMessage: "Failed to delete secret from keyring",
      expectedLogEvent: "keyring_delete_failed",
    },
  ])("sanitizes $operation failures while preserving $expectedCode", async ({
    operation,
    throwingMock,
    run,
    expectedCode,
    expectedMessage,
    expectedLogEvent,
  }) => {
    const { isKeyringAvailable } = await import("./keyring.js");
    await isKeyringAvailable(); // prime availability cache
    throwingMock();

    const result = await run();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(expectedCode);
      expect(result.error.message).toBe(expectedMessage);
      expect(result.error).toEqual({
        code: expectedCode,
        message: expectedMessage,
        details: undefined,
      });
      expectNoErrorDetails(result.error);
      expectMessageOmitsSentinels(result.error.message);
      expect(mockLog.mock.calls).toEqual([
        ["warn", expectedLogEvent, { code: expectedCode, operation }],
      ]);
      expectLogsOmitSentinels();
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

    expect(await isKeyringAvailable()).toBe(false);
    expect(mockLog.mock.calls).toEqual([
      ["warn", "keyring_module_unavailable", { code: "KEYRING_UNAVAILABLE", operation: "load" }],
    ]);
    expectLogsOmitSentinels();
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
      expect(result.error).toEqual({
        code: "KEYRING_UNAVAILABLE",
        message: "System keyring is not available",
        details: undefined,
      });
      expectNoErrorDetails(result.error);
      expect(mockLog.mock.calls).toEqual([
        ["warn", "keyring_module_unavailable", { code: "KEYRING_UNAVAILABLE", operation: "load" }],
      ]);
      expectLogsOmitSentinels();
    }
  });
});
