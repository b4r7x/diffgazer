import { expect, vi } from "vitest";

const PROCESS_EXIT_SENTINEL = "injected process exit";

/**
 * `withErrorHandler` ends a failed command with `process.exit(1)`, which never
 * returns. The stub throws so the test control flow matches production: a
 * returning stub would let assertions continue past a point the real process
 * can never reach.
 */
export async function expectCommandExit(action: () => Promise<unknown>): Promise<void> {
  const exit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error(PROCESS_EXIT_SENTINEL);
  });
  try {
    await expect(action()).rejects.toThrow(PROCESS_EXIT_SENTINEL);
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    exit.mockRestore();
  }
}
