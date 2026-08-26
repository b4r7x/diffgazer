import { KeyboardProvider } from "@diffgazer/keys";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const retryMock = vi.fn();
const serverState = {
  current: { status: "error", message: "Could not connect" } as {
    status: "checking" | "connected" | "error";
    message?: string;
  },
};

vi.mock("@diffgazer/core/api/hooks", () => ({
  useServerStatus: () => ({ state: serverState.current, retry: retryMock }),
}));

import { BASE_URL } from "@/lib/api";
import { RootLayout } from "./__root";

describe("RootLayout retry wiring", () => {
  afterEach(() => {
    cleanup();
    retryMock.mockReset();
    serverState.current = { status: "error", message: "Could not connect" };
  });

  it("survives a rejected retry without unhandled rejection while keeping disconnected UI", async () => {
    const user = userEvent.setup();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event.reason);
    };
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    retryMock.mockRejectedValue(new Error("still disconnected"));

    render(<RootLayout />);

    expect(screen.getByRole("heading", { name: /server disconnected/i })).toBeInTheDocument();

    // The detail rows tell only the truth: the polled health URL and the
    // error the browser actually reported.
    const connection = screen.getByRole("log", { name: "connection" });
    expect(connection).toHaveTextContent(`target ${BASE_URL}/api/health`);
    expect(connection).toHaveTextContent("error Could not connect");

    await user.click(screen.getByRole("button", { name: /retry connection/i }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(unhandledRejections).toEqual([]);
    expect(screen.getByRole("heading", { name: /server disconnected/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry connection/i })).toBeInTheDocument();

    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  });

  it("focuses Retry Connection on the disconnect gate and retries on r", async () => {
    const user = userEvent.setup();
    retryMock.mockResolvedValue(undefined);

    render(
      <KeyboardProvider>
        <RootLayout />
      </KeyboardProvider>,
    );

    expect(screen.getByRole("button", { name: /retry connection/i })).toHaveFocus();
    // The gate renders outside the shell, so its own footer strip is the only
    // place r is advertised.
    expect(screen.getByText("r")).toBeInTheDocument();

    await user.keyboard("r");

    expect(retryMock).toHaveBeenCalledTimes(1);
  });
});
