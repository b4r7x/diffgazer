// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavProvider } from "@/hooks/mobile-nav-context";
import { stubMatchMedia } from "@/testing/match-media";
import { LegalPageView } from "./page-view";

const routerInvalidate = vi.hoisted(() => vi.fn());
const termsChunk = vi.hoisted(() => ({
  reject: null as ((error: Error) => void) | null,
}));
const privacyFixture = vi.hoisted(() => ({
  frontmatter: {
    title: "Privacy policy",
    description: "How Diffgazer handles the data you give it.",
  },
  body: "We only ever process what keeps Diffgazer working for you.",
}));

// Boundary mock: the generated collection supplies a controllable rejected MDX chunk for the
// Terms page and a resolved MDX fixture for the Privacy page, invoking the real `component`
// renderer LegalPageView supplies so the LegalPageView and its useContent call stay on the
// production path.
vi.mock("../../../../.source/browser", async () => {
  const { lazy } = await import("react");
  const RejectedTermsMdx = lazy(
    () =>
      new Promise<{ default: ComponentType }>((_resolve, reject) => {
        termsChunk.reject = reject;
      }),
  );
  function PrivacyMdxBody() {
    return <p>{privacyFixture.body}</p>;
  }
  return {
    default: {
      legal: {
        createClientLoader: (options: {
          component: (loaded: {
            frontmatter: typeof privacyFixture.frontmatter;
            default: ComponentType;
          }) => ReactNode;
        }) => ({
          preload: async () => undefined,
          getComponent: () => RejectedTermsMdx,
          useContent: (path: string) => {
            if (path === "privacy.mdx") {
              return options.component({
                frontmatter: privacyFixture.frontmatter,
                default: PrivacyMdxBody,
              });
            }
            return <RejectedTermsMdx />;
          },
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

  it("renders a resolved Privacy page's frontmatter, MDX body, and last-updated copy inside the legal shell", async () => {
    render(
      <KeyboardProvider>
        <MobileNavProvider>
          <LegalPageView
            panelLabel="PRIVACY"
            data={{
              path: "privacy.mdx",
              title: privacyFixture.frontmatter.title,
              description: privacyFixture.frontmatter.description,
              lastUpdated: "January 5, 2026",
            }}
          />
        </MobileNavProvider>
      </KeyboardProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: privacyFixture.frontmatter.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(privacyFixture.frontmatter.description)).toBeInTheDocument();
    expect(screen.getByText(privacyFixture.body)).toBeInTheDocument();
    expect(screen.getByText("Last updated: January 5, 2026")).toBeInTheDocument();
    expect(screen.getByText("[ LEGAL / PRIVACY ]")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar navigation" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Privacy/ })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: /Terms/ })).toHaveAttribute("href", "/terms");
  });
});
