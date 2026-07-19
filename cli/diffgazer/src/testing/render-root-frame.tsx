import { PassThrough, Writable } from "node:stream";
import { FooterProvider } from "@diffgazer/core/footer";
import { render } from "ink";
import type { ReactNode } from "react";
import { NavigationProvider } from "../app/providers/navigation-provider";
import { GlobalLayout } from "../components/layout/global";
import { CliThemeProvider } from "../theme/provider";

class TestOutput extends Writable {
  readonly frames: string[] = [];
  readonly isTTY = true;

  constructor(
    readonly columns: number,
    readonly rows: number,
  ) {
    super();
  }

  override _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.frames.push(chunk.toString());
    callback();
  }
}

class TestInput extends PassThrough {
  readonly isTTY = true;

  setRawMode(): this {
    return this;
  }

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

export interface RootFrameView {
  frames: string[];
  stdin: TestInput;
  lastFrame: () => string | undefined;
  unmount: ReturnType<typeof render>["unmount"];
  cleanup: ReturnType<typeof render>["cleanup"];
}

const activeViews = new Set<Pick<RootFrameView, "unmount" | "cleanup">>();
const ANSI_SEQUENCE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[ -/]*[@-~]`, "g");

export function renderRootFrame(columns: number, rows: number, child: ReactNode): RootFrameView {
  const stdout = new TestOutput(columns, rows);
  const stderr = new TestOutput(columns, rows);
  const stdin = new TestInput();
  const instance = render(
    <NavigationProvider>
      <FooterProvider initialShortcuts={[]}>
        <CliThemeProvider initialTheme="dark">
          <GlobalLayout>{child}</GlobalLayout>
        </CliThemeProvider>
      </FooterProvider>
    </NavigationProvider>,
    {
      stdout: stdout as unknown as NodeJS.WriteStream,
      stderr: stderr as unknown as NodeJS.WriteStream,
      stdin: stdin as unknown as NodeJS.ReadStream,
      debug: true,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );
  const view = {
    frames: stdout.frames,
    stdin,
    lastFrame: () =>
      stdout.frames.findLast((frame) => frame.replaceAll(ANSI_SEQUENCE, "").trim().length > 0),
    unmount: instance.unmount,
    cleanup: instance.cleanup,
  };
  activeViews.add(view);
  return view;
}

export function cleanupRootFrames(): void {
  for (const view of activeViews) {
    view.unmount();
    view.cleanup();
  }
  activeViews.clear();
}
