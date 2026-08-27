/**
 * @vitest-environment jsdom
 */
import { render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetShutdownPromiseForTests,
  useExit,
  useRegisterExitPreparation,
} from "../../hooks/use-exit";
import { ExitPreparationProvider } from "./exit-preparation";

function Wrapper({ children }: { children: ReactNode }) {
  return <ExitPreparationProvider>{children}</ExitPreparationProvider>;
}

afterEach(() => {
  __resetShutdownPromiseForTests();
  vi.restoreAllMocks();
});

describe("ExitPreparationProvider", () => {
  it("awaits registered onboarding cleanup before process exit", async () => {
    let resolveCleanup: () => void = () => {};
    const cleanup = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCleanup = resolve;
        }),
    );
    const exitProcess = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as typeof process.exit);

    const { result } = renderHook(
      () => {
        useRegisterExitPreparation(cleanup);
        return useExit();
      },
      { wrapper: Wrapper },
    );

    result.current.handleExit();

    expect(cleanup).toHaveBeenCalledOnce();
    expect(exitProcess).not.toHaveBeenCalled();

    resolveCleanup();
    await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledOnce());
  });

  it("skips preparation when the registering screen has unmounted", async () => {
    const cleanup = vi.fn(async () => {});
    const exitProcess = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as unknown as typeof process.exit);
    let handleExit: () => void = () => {};

    function Registrar() {
      useRegisterExitPreparation(cleanup);
      return null;
    }

    function ExitProbe() {
      handleExit = useExit().handleExit;
      return null;
    }

    function Tree({ registered }: { registered: boolean }) {
      return (
        <ExitPreparationProvider>
          {registered ? <Registrar /> : null}
          <ExitProbe />
        </ExitPreparationProvider>
      );
    }

    const { rerender } = render(<Tree registered />);
    rerender(<Tree registered={false} />);

    handleExit();

    expect(cleanup).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(exitProcess).toHaveBeenCalledOnce());
  });
});
