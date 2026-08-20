import { type BoundApi, createApi } from "@diffgazer/core/api";
import { useActiveReviewSession, useReviews } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { Toaster } from "@diffgazer/ui/components/toast";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrustPanel } from "@/components/shared/trust-panel";
import { FooterView } from "@/testing/footer-view";

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

describe("TrustPanel", () => {
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

    const repoAccess = screen.getByRole("checkbox", { name: /repository access/i });
    expect(repoAccess).toHaveAttribute("aria-checked", "true");
    await user.click(repoAccess);
    expect(repoAccess).toHaveAttribute("aria-checked", "false");

    await user.click(screen.getByRole("button", { name: /continue without trust/i }));

    await waitFor(() => {
      expect(saveTrust).toHaveBeenCalledWith({
        capabilities: { readFiles: false, runCommands: false },
        trustMode: "persistent",
      });
    });

    await waitFor(() => {
      expect(getReviews).toHaveBeenCalledTimes(2);
      expect(getActiveReviewSession).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps focus on the busy trust button while the save is in flight", async () => {
    const user = userEvent.setup();
    const pendingSave = createDeferred<Awaited<ReturnType<BoundApi["saveTrust"]>>>();
    saveTrust = vi.fn<BoundApi["saveTrust"]>().mockReturnValue(pendingSave.promise);
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    const repoAccess = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(repoAccess).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    const trustButton = screen.getByRole("button", { name: /trust & continue/i });
    expect(trustButton).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(saveTrust).toHaveBeenCalledTimes(1));

    // The transient busy state must not blur the keyboard user: the button stays
    // focusable (aria-disabled) instead of turning natively disabled.
    expect(trustButton).toHaveFocus();
    expect(trustButton).not.toBeDisabled();
    expect(trustButton).toHaveAttribute("aria-disabled", "true");
    expect(trustButton).toHaveAttribute("aria-busy", "true");
    // The spinner is the only busy affordance: a "Saving..." label would rename
    // the button under the focus the assertions above just protected.
    expect(trustButton).toHaveAccessibleName("Trust & Continue");

    // Activating again while busy must not start a second save.
    await user.keyboard("{Enter}");
    expect(saveTrust).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingSave.resolve({
        trust: {
          projectId: "proj-1",
          repoRoot: "/repo",
          capabilities: { readFiles: true, runCommands: false },
          trustMode: "persistent",
          trustedAt: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => expect(trustButton).not.toHaveAttribute("aria-disabled"));
  });

  it("returns focus from the trust button to the permission list on ArrowUp", async () => {
    const user = userEvent.setup();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    const repoAccess = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(repoAccess).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /trust & continue/i })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(repoAccess).toHaveFocus();
  });

  it("leaves a modified ArrowUp on the trust button native", async () => {
    const user = userEvent.setup();
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    const repoAccess = screen.getByRole("checkbox", { name: /repository access/i });
    await waitFor(() => expect(repoAccess).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    const trustButton = screen.getByRole("button", { name: /trust & continue/i });
    expect(trustButton).toHaveFocus();

    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(trustButton).toHaveFocus();

    await user.keyboard("{Control>}{ArrowUp}{/Control}");
    expect(trustButton).toHaveFocus();
  });

  it("registers its own permission footer so trust-gated branches drop stale page hints", async () => {
    const api = { ...createApi({ baseUrl: "http://localhost" }), saveTrust } satisfies BoundApi;

    renderTrustPanel(api);

    expect(await screen.findByText("Navigate Permissions")).toBeInTheDocument();
    expect(screen.getByText("Toggle")).toBeInTheDocument();
    expect(screen.queryByText("Quit")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });
});
