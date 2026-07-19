import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const renderMock = vi.hoisted(() => vi.fn());
const ensureShutdownTokenMock = vi.hoisted(() => vi.fn());
const createTerminalInputBoundaryMock = vi.hoisted(() => vi.fn());

vi.mock("ink", () => ({ render: renderMock }));
vi.mock("./app/root", () => ({ App: () => null }));
vi.mock("./lib/shutdown-token", () => ({ ensureShutdownToken: ensureShutdownTokenMock }));
vi.mock("./lib/terminal-input", () => ({
  createTerminalInputBoundary: createTerminalInputBoundaryMock,
}));

import { startTui } from "./tui-entry";

const originalExitCode = process.exitCode;

function setTty(stream: NodeJS.ReadStream | NodeJS.WriteStream, isTTY: boolean): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(stream, "isTTY");
  Object.defineProperty(stream, "isTTY", { configurable: true, value: isTTY });
  return () => {
    if (descriptor) {
      Object.defineProperty(stream, "isTTY", descriptor);
    } else {
      Reflect.deleteProperty(stream, "isTTY");
    }
  };
}

let restoreStdin: () => void;
let restoreStdout: () => void;

beforeEach(() => {
  restoreStdin = setTty(process.stdin, true);
  restoreStdout = setTty(process.stdout, true);
  process.exitCode = originalExitCode;
  vi.clearAllMocks();
});

afterEach(() => {
  restoreStdin();
  restoreStdout();
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe("startTui", () => {
  test.each([
    [false, true],
    [true, false],
  ])("rejects non-TTY streams before rendering (stdin=%s, stdout=%s)", async (stdinTty, stdoutTty) => {
    restoreStdin();
    restoreStdout();
    restoreStdin = setTty(process.stdin, stdinTty);
    restoreStdout = setTty(process.stdout, stdoutTty);
    const stderrWrite = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await startTui({ mode: "prod" });

    expect(stderrWrite).toHaveBeenCalledWith("The TUI requires an interactive terminal (TTY).\n");
    expect(process.exitCode).toBe(1);
    expect(ensureShutdownTokenMock).not.toHaveBeenCalled();
    expect(createTerminalInputBoundaryMock).not.toHaveBeenCalled();
    expect(renderMock).not.toHaveBeenCalled();
  });

  test("renders interactive terminals in the alternate screen incrementally", async () => {
    const dispose = vi.fn();
    const queue = { consume: vi.fn() };
    createTerminalInputBoundaryMock.mockReturnValue({
      stdin: process.stdin,
      queue,
      dispose,
    });
    renderMock.mockReturnValue({ waitUntilExit: () => Promise.resolve() });

    await startTui({ mode: "prod", theme: "dark" });

    expect(renderMock).toHaveBeenCalledWith(expect.anything(), {
      stdin: process.stdin,
      exitOnCtrlC: false,
      alternateScreen: true,
      incrementalRendering: true,
    });
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  });
});
