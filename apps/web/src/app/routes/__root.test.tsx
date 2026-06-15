import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const retryMock = vi.fn();
const serverState = {
  current: { status: "error", message: "Could not connect" } as {
    status: "checking" | "connected" | "error";
    message?: string;
  },
};

// Boundary mock: core api hook wraps server-health HTTP polling; test drives retry state.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useServerStatus: () => ({ state: serverState.current, retry: retryMock }),
}));

import { RootLayout } from "./__root";

describe("RootLayout retry wiring", () => {
  afterEach(() => {
    cleanup();
    retryMock.mockReset();
  });

  it("attaches a catch handler so a rejected retry never escapes the click handler", async () => {
    const user = userEvent.setup();
    // The handler must call .catch on retry()'s promise; a raw onClick={retry}
    // would hand the rejecting promise to React with no catch (unhandled
    // rejection on every failed click against a still-down server). A thenable
    // with a spied catch proves the wiring without floating a real rejection.
    const catchSpy = vi.fn().mockReturnValue(Promise.resolve());
    retryMock.mockReturnValue({ catch: catchSpy } as unknown as Promise<unknown>);

    render(<RootLayout />);

    await user.click(screen.getByRole("button", { name: /retry connection/i }));

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(catchSpy).toHaveBeenCalled();
  });
});
