import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { RootLayout, RouteErrorBoundary } from "./__root";

describe("RootLayout retry wiring", () => {
  afterEach(() => {
    cleanup();
    retryMock.mockReset();
  });

  it("attaches a catch handler so a rejected retry never escapes the click handler", async () => {
    const user = userEvent.setup();
    // A raw onClick={retry} floats an unhandled rejection on every failed click;
    // the handler must .catch retry()'s promise.
    const catchSpy = vi.fn().mockReturnValue(Promise.resolve());
    retryMock.mockReturnValue({ catch: catchSpy } as unknown as Promise<unknown>);

    render(<RootLayout />);

    await user.click(screen.getByRole("button", { name: /retry connection/i }));

    expect(retryMock).toHaveBeenCalledTimes(1);
    expect(catchSpy).toHaveBeenCalled();
  });
});

describe("RouteErrorBoundary recovery", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllEnvs();
    cleanup();
  });

  function Thrower({ shouldThrow }: { shouldThrow: () => boolean }) {
    if (shouldThrow()) throw new Error("secret provider token leaked");
    return <div>route content</div>;
  }

  it("announces the failure with alert semantics instead of exposing a full reload", () => {
    render(
      <RouteErrorBoundary onReset={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("hides raw error detail in production and shows it only in dev", () => {
    vi.stubEnv("DEV", false);
    const { unmount } = render(
      <RouteErrorBoundary onReset={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );
    expect(screen.queryByText("secret provider token leaked")).not.toBeInTheDocument();
    unmount();

    vi.stubEnv("DEV", true);
    render(
      <RouteErrorBoundary onReset={vi.fn()}>
        <Thrower shouldThrow={() => true} />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText("secret provider token leaked")).toBeInTheDocument();
  });

  it("resets the route and re-renders children on retry without reloading the page", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    let thrown = true;

    render(
      <RouteErrorBoundary onReset={onReset}>
        <Thrower shouldThrow={() => thrown} />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();

    thrown = false;
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText("route content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
