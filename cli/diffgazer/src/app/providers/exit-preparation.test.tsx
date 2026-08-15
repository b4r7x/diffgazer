/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { type ReactNode, useContext } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetShutdownPromiseForTests,
  ExitPreparationContext,
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

  it("unregisters preparation when the registering screen unmounts", () => {
    const cleanup = vi.fn(async () => {});
    let preparationRef: React.MutableRefObject<(() => Promise<void>) | null> | undefined;

    function RegistrationProbe() {
      const context = useContext(ExitPreparationContext);
      preparationRef = context?.preparationRef;
      useRegisterExitPreparation(cleanup);
      return null;
    }

    const { unmount } = renderHook(() => null, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ExitPreparationProvider>
          <RegistrationProbe />
          {children}
        </ExitPreparationProvider>
      ),
    });

    expect(preparationRef?.current).toBe(cleanup);
    unmount();
    expect(preparationRef?.current).toBeNull();
  });
});
