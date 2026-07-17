import { PassThrough } from "node:stream";
import { render, useInput } from "ink";
import { useContext, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TerminalKeyboardProvider } from "../app/providers/keyboard";
import { KeyboardContext } from "../hooks/use-keyboard";
import { createTerminalInputBoundary } from "./terminal-input";

interface KeyboardProbeProps {
  onCtrlC: () => void;
  onShortcut: (shortcut: string) => void;
}

function KeyboardProbe({ onCtrlC, onShortcut }: KeyboardProbeProps): null {
  const keyboard = useContext(KeyboardContext);

  useEffect(() => {
    if (!keyboard) return;

    const unregister = ["s", "q", "?", "up", "escape"].map((shortcut) =>
      keyboard.registerGlobalHandler(shortcut, () => onShortcut(shortcut)),
    );
    return () => {
      for (const remove of unregister) remove();
    };
  }, [keyboard, onShortcut]);

  useInput((input, key) => {
    if (input === "c" && key.ctrl) onCtrlC();
  });

  return null;
}

interface MountedKeyboard {
  close(): Promise<void>;
  readonly source: PassThrough;
}

const mounted: MountedKeyboard[] = [];

function createTestStdin(): PassThrough & {
  readonly isTTY: true;
  setRawMode(value: boolean): void;
  ref(): void;
  unref(): void;
} {
  return Object.assign(new PassThrough(), {
    isTTY: true as const,
    setRawMode(_value: boolean) {},
    ref() {},
    unref() {},
  });
}

function createTestOutput() {
  return Object.assign(new PassThrough(), {
    columns: 100,
    rows: 30,
    isTTY: false,
  });
}

async function mountKeyboard({
  onCtrlC = () => {},
  onShortcut = () => {},
  source = createTestStdin(),
}: {
  onCtrlC?: () => void;
  onShortcut?: (shortcut: string) => void;
  source?: ReturnType<typeof createTestStdin>;
} = {}): Promise<MountedKeyboard> {
  const terminalInput = createTerminalInputBoundary(source);
  const stdout = createTestOutput();
  const stderr = createTestOutput();
  const instance = render(
    <TerminalKeyboardProvider terminalInputQueue={terminalInput.queue}>
      <KeyboardProbe onCtrlC={onCtrlC} onShortcut={onShortcut} />
    </TerminalKeyboardProvider>,
    {
      stdin: terminalInput.stdin,
      // @ts-expect-error The debug-mode test stream implements Ink's runtime writes, not the full TTY API.
      stdout,
      // @ts-expect-error The debug-mode test stream implements Ink's runtime writes, not the full TTY API.
      stderr,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );
  await instance.waitUntilRenderFlush();

  let closePromise: Promise<void> | undefined;
  const mountedKeyboard = {
    source,
    close() {
      closePromise ??= (async () => {
        instance.unmount();
        terminalInput.dispose();
        await instance.waitUntilExit();
        instance.cleanup();
        stdout.destroy();
        stderr.destroy();
      })();
      return closePromise;
    },
  } satisfies MountedKeyboard;
  mounted.push(mountedKeyboard);
  return mountedKeyboard;
}

function observeBoundaryInput() {
  const source = createTestStdin();
  const terminalInput = createTerminalInputBoundary(source);
  const received: string[] = [];
  const read = () => {
    let chunk: unknown = terminalInput.stdin.read();
    while (chunk !== null) {
      received.push(String(chunk));
      chunk = terminalInput.stdin.read();
    }
  };

  terminalInput.stdin.setEncoding("utf8");
  source.on("readable", read);

  return {
    received,
    source,
    terminalInput,
    close() {
      terminalInput.dispose();
      source.removeListener("readable", read);
      source.destroy();
    },
  };
}

afterEach(async () => {
  for (const keyboard of mounted.splice(0)) await keyboard.close();
});

describe("terminal input boundary", () => {
  it("rejects legacy Alt+S, Alt+Q, and Alt+? before Ink drops raw input details", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    for (const input of ["\u001bs", "\u001bq", "\u001b?"]) source.write(input);
    await new Promise((resolve) => setImmediate(resolve));

    expect(onShortcut).not.toHaveBeenCalled();
  });

  it("classifies a legacy Alt sequence split across stdin chunks", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    source.write("\u001b");
    source.write("?");
    await new Promise((resolve) => setImmediate(resolve));

    expect(onShortcut).not.toHaveBeenCalled();
  });

  it("keeps a delayed split Alt sequence out of bare Escape and printable shortcuts", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    source.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 35));
    source.write("s");
    await new Promise((resolve) => setImmediate(resolve));

    expect(onShortcut).not.toHaveBeenCalled();
  });

  it("assembles delayed split CSI navigation without dispatching bare Escape", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    source.write("\u001b");
    await new Promise((resolve) => setTimeout(resolve, 35));
    source.write("[1;5A");

    await vi.waitFor(() => expect(onShortcut).toHaveBeenCalledExactlyOnceWith("up"));
  });

  it("expires a true bare Escape before dispatching a later bare shortcut", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    source.write("\u001b");
    await vi.waitFor(() => expect(onShortcut).toHaveBeenCalledExactlyOnceWith("escape"));

    source.write("s");
    await vi.waitFor(() => expect(onShortcut).toHaveBeenCalledTimes(2));
    expect(onShortcut.mock.calls).toEqual([["escape"], ["s"]]);
  });

  it("keeps bare s, q, and ? dispatchable", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    for (const [index, input] of ["s", "q", "?"].entries()) {
      source.write(input);
      await vi.waitFor(() => expect(onShortcut).toHaveBeenCalledTimes(index + 1));
    }
    expect(onShortcut.mock.calls).toEqual([["s"], ["q"], ["?"]]);
  });

  it("keeps CSI-u Ctrl, Alt, and Meta variants out of bare shortcuts", async () => {
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onShortcut });

    for (const input of [
      "\u001b[115;5u",
      "\u001b[113;5u",
      "\u001b[63;5u",
      "\u001b[115;3u",
      "\u001b[113;3u",
      "\u001b[63;3u",
      "\u001b[115;33u",
      "\u001b[113;33u",
      "\u001b[63;33u",
    ]) {
      source.write(input);
    }
    await new Promise((resolve) => setImmediate(resolve));

    expect(onShortcut).not.toHaveBeenCalled();
  });

  it("preserves Ctrl+C and modified navigation", async () => {
    const onCtrlC = vi.fn();
    const onShortcut = vi.fn();
    const { source } = await mountKeyboard({ onCtrlC, onShortcut });

    source.write("\u0003");
    source.write("\u001b[1;5A");

    await vi.waitFor(() => {
      expect(onCtrlC).toHaveBeenCalledTimes(1);
      expect(onShortcut).toHaveBeenCalledExactlyOnceWith("up");
    });
  });

  it("does not put bracketed paste assembly behind the Escape hold deadline", async () => {
    const { close, received, source, terminalInput } = observeBoundaryInput();
    try {
      source.write("\u001b[200~");
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(received.join("")).toBe("\u001b[200~");

      source.write("pasted text");
      source.write("\u001b[201~");
      await new Promise((resolve) => setImmediate(resolve));

      expect(received.join("")).toBe("\u001b[200~pasted text\u001b[201~");
      expect(terminalInput.queue.consume()).toBe("ordinary");
    } finally {
      close();
    }
  });

  it("drops pending split input on dispose without replacing the source reader", async () => {
    const { close, received, source, terminalInput } = observeBoundaryInput();
    const sourceRead = source.read;

    try {
      source.write("\u001b");
      await new Promise((resolve) => setImmediate(resolve));
      terminalInput.dispose();
      source.write("?");
      await new Promise((resolve) => setImmediate(resolve));

      expect(received.join("")).toBe("\u001b?");
      expect(terminalInput.queue.consume()).toBeUndefined();
      expect(source.read).toBe(sourceRead);
    } finally {
      close();
    }
  });
});
