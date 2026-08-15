import { FooterProvider } from "@diffgazer/core/footer";
import { render } from "ink";
import type { ReactNode } from "react";
import { NavigationProvider } from "../app/providers/navigation";
import { GateFrame } from "../app/root";
import { GlobalLayout } from "../components/layout/global";
import { CliThemeProvider } from "../theme/provider";
import { TestInput, TestOutput } from "./ink-streams";

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
          <GateFrame>
            <GlobalLayout>{child}</GlobalLayout>
          </GateFrame>
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
