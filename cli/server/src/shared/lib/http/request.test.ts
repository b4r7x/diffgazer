import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../paths.js", () => ({
  PROJECT_ROOT_HEADER: "x-diffgazer-project-root",
  resolveProjectRoot: vi.fn((opts: { header?: string | null; env?: string | null; cwd?: string | null }) => {
    if (opts?.header) return `/from-header/${opts.header}`;
    if (opts?.env) return opts.env;
    return "/fallback";
  }),
}));

import { getProjectRoot } from "./request.js";
import { resolveProjectRoot } from "../paths.js";

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
    const c = createMockContext({ "x-diffgazer-project-root": "/user/supplied" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: "/user/supplied" }),
    );
  });

  it("ignores the client header in dev mode without opt-in", () => {
    delete process.env.DIFFGAZER_PACKAGED;
    delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    const c = createMockContext({ "x-diffgazer-project-root": "/user/supplied" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: undefined }),
    );
  });

  it("ignores the client header in packaged mode", () => {
    process.env.DIFFGAZER_PACKAGED = "1";
    const c = createMockContext({ "x-diffgazer-project-root": "/malicious/path" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: undefined }),
    );
  });

  it("falls through to env when packaged and header is present", () => {
    process.env.DIFFGAZER_PACKAGED = "1";
    process.env.DIFFGAZER_PROJECT_ROOT = "/safe/root";
    const c = createMockContext({ "x-diffgazer-project-root": "/evil" });

    getProjectRoot(c);

    expect(resolveProjectRoot).toHaveBeenCalledWith(
      expect.objectContaining({ header: undefined, env: "/safe/root" }),
    );
  });
});
