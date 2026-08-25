import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitStatus } from "../schemas/git.js";
import { GIT_STATUS_RESPONSE_MAX_BYTES, getGitStatus } from "./git.js";
import { createMockClient } from "./test-helpers.js";
import type { ApiClient } from "./types.js";

function makeStatus(): GitStatus {
  return {
    isGitRepo: true,
    branch: "main",
    remoteBranch: null,
    ahead: 0,
    behind: 0,
    files: {
      staged: [{ path: "src/a.ts", indexStatus: "M", workTreeStatus: " " }],
      unstaged: [],
      untracked: [],
    },
    hasChanges: true,
    conflicted: [],
  };
}

describe("git API functions", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("reads the working tree status with a response bound a very dirty tree still fits", async () => {
    const status = makeStatus();
    vi.mocked(client.get).mockResolvedValue(status);

    const result = await getGitStatus(client);

    expect(client.get).toHaveBeenCalledWith("/api/git/status", {
      maxResponseBytes: GIT_STATUS_RESPONSE_MAX_BYTES,
      schema: expect.any(Function),
    });
    expect(result).toEqual(status);
  });

  it("forwards an abort signal so a picker that closes stops its in-flight read", async () => {
    vi.mocked(client.get).mockResolvedValue(makeStatus());
    const controller = new AbortController();

    await getGitStatus(client, controller.signal);

    expect(client.get).toHaveBeenCalledWith(
      "/api/git/status",
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("validates the response against the git status schema", async () => {
    vi.mocked(client.get).mockResolvedValue(makeStatus());

    await getGitStatus(client);

    const options = vi.mocked(client.get).mock.calls[0]?.[1];
    expect(() => options?.schema?.({ isGitRepo: "yes" })).toThrow();
    expect(options?.schema?.(makeStatus())).toEqual(makeStatus());
  });
});
