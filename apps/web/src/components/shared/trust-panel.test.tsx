import { type BoundApi, createApi } from "@diffgazer/core/api";
import { useActiveReviewSession, useReviews } from "@diffgazer/core/api/hooks";
import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";
import { TrustPanel } from "@/components/shared/trust-panel";

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function ReviewQueryProbe() {
  useReviews();
  useActiveReviewSession();
  return null;
}

function renderTrustPanel(api: BoundApi, options: { seedReviewQueries?: boolean } = {}) {
  const { Wrapper: ApiWrapper } = createTestQueryWrapper({ api });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ApiWrapper>
        <FooterProvider>
          <KeyboardProvider>
            {children}
            <FooterView />
            <Toaster />
          </KeyboardProvider>
        </FooterProvider>
      </ApiWrapper>
    );
  }

  return render(
    <>
      <TrustPanel directory="/repo" />
      {options.seedReviewQueries ? <ReviewQueryProbe /> : null}
    </>,
    { wrapper: Wrapper },
  );
}

describe("TrustPanel query invalidation", () => {
  let saveTrust: BoundApi["saveTrust"];

  beforeEach(() => {
    saveTrust = vi.fn<BoundApi["saveTrust"]>().mockResolvedValue({
      trust: {
        projectId: "proj-1",
        repoRoot: "/repo",
        capabilities: { readFiles: true, runCommands: false },
        trustMode: "persistent",
        trustedAt: new Date().toISOString(),
      },
    });
  });

  it("invalidates review and active-session queries after trust is granted", async () => {
    const user = userEvent.setup();
    const getReviews = vi.fn<BoundApi["getReviews"]>().mockResolvedValue({ reviews: [] });
    const getActiveReviewSession = vi
      .fn<BoundApi["getActiveReviewSession"]>()
      .mockResolvedValue({ session: null });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getReviews,
      getActiveReviewSession,
      saveTrust,
    } satisfies BoundApi;

    renderTrustPanel(api, { seedReviewQueries: true });

    await waitFor(() => {
      expect(getReviews).toHaveBeenCalledTimes(1);
      expect(getActiveReviewSession).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: /trust & continue/i }));

    await waitFor(() => {
      expect(saveTrust).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(getReviews).toHaveBeenCalledTimes(2);
      expect(getActiveReviewSession).toHaveBeenCalledTimes(2);
    });
  });

  it("registers its own permission footer so trust-gated branches drop stale page hints", async () => {
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    // F-087: a trust branch with no footer of its own (e.g. history) keeps the
    // previous page's stale "q Quit"/"s Settings" hints over dead handlers.
    expect(await screen.findByText("Navigate Permissions")).toBeInTheDocument();
    expect(screen.getByText("Toggle Permission")).toBeInTheDocument();
    expect(screen.queryByText("Quit")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
