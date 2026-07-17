// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { LegalPageView } from "./page-view";

const routerInvalidate = vi.hoisted(() => vi.fn());
const termsChunk = vi.hoisted(() => ({
  reject: null as ((error: Error) => void) | null,
}));

// Boundary mock: the generated collection supplies a controllable rejected MDX chunk while the
// LegalPageView and its useContent call stay on the production path.
vi.mock("../../../../.source/browser", async () => {
  const { lazy } = await import("react");
  const RejectedTermsMdx = lazy(
    () =>
      new Promise<{ default: ComponentType }>((_resolve, reject) => {
        termsChunk.reject = reject;
      }),
  );
  return {
    default: {
      legal: {
        createClientLoader: () => ({
          preload: async () => undefined,
          getComponent: () => RejectedTermsMdx,
          useContent: () => <RejectedTermsMdx />,
        }),
      },
    },
  };
});

// Boundary mock: only the external router is replaced.
vi.mock("@tanstack/react-router", async () => {
  const { RouterLinkMock, useLocationMock } = await import("@/testing/router-mock");
  return {
    Link: RouterLinkMock,
    ...useLocationMock({ pathname: "/terms" }),
    useRouter: () => ({ invalidate: routerInvalidate }),
  };
});

beforeEach(() => {
  stubMatchMedia({ isDesktop: true });
  Element.prototype.scrollIntoView = () => {};
  routerInvalidate.mockReset();
  termsChunk.reject = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LegalPageView", () => {
  it("isolates a rejected Terms chunk inside the legal shell and reloads the document", async () => {
    const reload = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <LegalPageView
            panelLabel="TERMS"
            data={{ path: "terms.mdx", title: "Terms of service" }}
          />
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    await waitFor(() => expect(termsChunk.reject).not.toBeNull());
    await act(async () => {
      termsChunk.reject?.(new Error("terms chunk failed"));
    });

    expect(await screen.findByText("Legal page unavailable")).toBeInTheDocument();
    expect(screen.getByText("[ LEGAL / TERMS ]")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy/ })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /Terms/ })).toHaveAttribute("href", "/terms");
    expect(screen.queryByRole("heading", { name: "Something went wrong" })).not.toBeInTheDocument();

    vi.stubGlobal("location", { reload });
    await user.click(screen.getByRole("button", { name: "Reload" }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(routerInvalidate).not.toHaveBeenCalled();
  });
});
