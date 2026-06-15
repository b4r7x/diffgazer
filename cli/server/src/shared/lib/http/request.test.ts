import { PROJECT_ROOT_HEADER } from "@diffgazer/core/api/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mock: paths resolve OS/env project roots; tests pin request-header handling without depending on the host cwd.
vi.mock("../paths.js", () => ({
  isPackaged: () => process.env.DIFFGAZER_PACKAGED === "1",
  resolveProjectRoot: vi.fn(
    (opts: { header?: string | null; env?: string | null; cwd?: string | null }) => {
      if (opts?.header) return `/from-header/${opts.header}`;
      if (opts?.env) return opts.env;
      return "/fallback";
    },
  ),
}));

import { resolveProjectRoot } from "../paths.js";
import { getProjectRoot } from "./request.js";

function createMockContext(headers: Record<string, string> = {}) {
  return {
    req: {
      header: (name: string) => headers[name],
    },
  } as Parameters<typeof getProjectRoot>[0];
}

describe("getProjectRoot", () => {
  let originalPackaged: string | undefined;
  let originalProjectRoot: string | undefined;
  let originalDevUnsafe: string | undefined;

  beforeEach(() => {
    originalPackaged = process.env.DIFFGAZER_PACKAGED;
    originalProjectRoot = process.env.DIFFGAZER_PROJECT_ROOT;
    originalDevUnsafe = process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    vi.mocked(resolveProjectRoot).mockClear();
  });

  afterEach(() => {
    if (originalPackaged === undefined) {
      delete process.env.DIFFGAZER_PACKAGED;
    } else {
      process.env.DIFFGAZER_PACKAGED = originalPackaged;
    }
    if (originalProjectRoot === undefined) {
      delete process.env.DIFFGAZER_PROJECT_ROOT;
    } else {
      process.env.DIFFGAZER_PROJECT_ROOT = originalProjectRoot;
    }
    if (originalDevUnsafe === undefined) {
      delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    } else {
      process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = originalDevUnsafe;
    }
  });

  it("passes the client header in dev mode with explicit opt-in", () => {
    delete process.env.DIFFGAZER_PACKAGED;
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";
    const c = createMockContext({ [PROJECT_ROOT_HEADER]: "/user/supplied" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: "/user/supplied" }),
    );
  });

  it("ignores the client header in dev mode without opt-in", () => {
    delete process.env.DIFFGAZER_PACKAGED;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    const c = createMockContext({ [PROJECT_ROOT_HEADER]: "/user/supplied" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(expect.objectContaining({ header: undefined }));
  });

  it("ignores the client header in packaged mode", () => {
    process.env.DIFFGAZER_PACKAGED = "1";
    const c = createMockContext({ [PROJECT_ROOT_HEADER]: "/malicious/path" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(expect.objectContaining({ header: undefined }));
  });

  it("falls through to env when packaged and header is present", () => {
    process.env.DIFFGAZER_PACKAGED = "1";
    process.env.DIFFGAZER_PROJECT_ROOT = "/safe/root";
    const c = createMockContext({ [PROJECT_ROOT_HEADER]: "/evil" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: undefined, env: "/safe/root" }),
    );
  });
});
