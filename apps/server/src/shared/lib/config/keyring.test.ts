import { describe, it, expect, vi, beforeEach } from "vitest";

// Track the last password set, so availability check's write/read roundtrip succeeds
let lastSetPassword: string | null = null;
const mockGetPassword = vi.fn(() => lastSetPassword);
const mockSetPassword = vi.fn((value: string) => { lastSetPassword = value; });
const mockDeletePassword = vi.fn();

const { mockRequireModule } = vi.hoisted(() => ({
  mockRequireModule: vi.fn(),
}));

vi.mock("node:module", () => ({
  createRequire: vi.fn(() => mockRequireModule),
}));

function setupKeyringAvailable() {
  lastSetPassword = null;
  mockGetPassword.mockImplementation(() => lastSetPassword);
  mockSetPassword.mockImplementation((value: string) => { lastSetPassword = value; });
  mockDeletePassword.mockReturnValue(undefined);

  const MockEntry = function (this: any, _service: string, _account: string) {
    this.getPassword = mockGetPassword;
    this.setPassword = mockSetPassword;
    this.deletePassword = mockDeletePassword;
  } as any;

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

  it("should return true from isKeyringAvailable when keyring works", async () => {
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(isKeyringAvailable()).toBe(true);
  });

  it("should return ok with password value from readKeyringSecret", async () => {
    const { isKeyringAvailable, readKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable(); // prime availability cache
    mockGetPassword.mockReturnValue("my-secret");

    const result = readKeyringSecret("api-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("my-secret");
    }
  });

  it("should return KEYRING_READ_FAILED when getPassword throws", async () => {
    const { isKeyringAvailable, readKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable(); // prime availability cache
    mockGetPassword.mockImplementation(() => {
      throw new Error("access denied");
    });

    const result = readKeyringSecret("api-key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_READ_FAILED");
    }
  });

  it("should return ok from writeKeyringSecret on success", async () => {
    const { isKeyringAvailable, writeKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockSetPassword.mockReturnValue(undefined);

    const result = writeKeyringSecret("api-key", "secret-value");

    expect(result.ok).toBe(true);
  });

  it("should return KEYRING_WRITE_FAILED when setPassword throws", async () => {
    const { isKeyringAvailable, writeKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockSetPassword.mockImplementation(() => {
      throw new Error("permission denied");
    });

    const result = writeKeyringSecret("api-key", "value");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_WRITE_FAILED");
    }
  });

  it("should return ok(true) from deleteKeyringSecret when key exists", async () => {
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

  it("should return ok(false) from deleteKeyringSecret when key does not exist", async () => {
    const { isKeyringAvailable, deleteKeyringSecret } = await import("./keyring.js");
    isKeyringAvailable();
    mockGetPassword.mockReturnValue(null);

    const result = deleteKeyringSecret("nonexistent-key");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });
});

describe("keyring (unavailable)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setupKeyringUnavailable();
  });

  it("should return false from isKeyringAvailable when module is missing", async () => {
    const { isKeyringAvailable } = await import("./keyring.js");

    expect(isKeyringAvailable()).toBe(false);
  });

  it("should return KEYRING_UNAVAILABLE from readKeyringSecret", async () => {
    const { readKeyringSecret } = await import("./keyring.js");

    const result = readKeyringSecret("test-key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    }
  });

  it("should return KEYRING_UNAVAILABLE from writeKeyringSecret", async () => {
    const { writeKeyringSecret } = await import("./keyring.js");

    const result = writeKeyringSecret("test-key", "value");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    }
  });

  it("should return KEYRING_UNAVAILABLE from deleteKeyringSecret", async () => {
    const { deleteKeyringSecret } = await import("./keyring.js");

    const result = deleteKeyringSecret("test-key");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("KEYRING_UNAVAILABLE");
    }
  });
});
