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
});
