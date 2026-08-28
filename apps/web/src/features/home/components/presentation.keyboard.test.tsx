import type { HomeContextInfo } from "@diffgazer/core/schemas/presentation";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HomePagePresentation,
  type HomePagePresentationProps,
} from "@/features/home/components/presentation";
import {
  baseContext,
  buildProps,
  createNavigateMock,
  renderPresentation,
  renderPresentationWithApi,
  TrustKeyProbe,
  Wrapper,
} from "@/features/home/testing/presentation-harness";
import { drainToasts } from "@/testing/toast-fixtures";

beforeEach(async () => {
  await drainToasts();
});

describe("HomePagePresentation — pane Tab cycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Stands in for the shell chrome outside the panes — the skip link, the header. */
  function renderWithChrome(props: HomePagePresentationProps) {
    return render(
      <>
        <button type="button">Before the panes</button>
        <HomePagePresentation {...props} />
      </>,
      { wrapper: Wrapper },
    );
  }

  it("hops Tab between the menu and the context pane instead of leaving the page", async () => {
    const user = userEvent.setup();
    renderPresentation(buildProps());

    const menu = screen.getByRole("menu");
    const providerRow = screen.getByRole("button", { name: "Configure provider settings" });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(providerRow).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(menu).toHaveFocus());

    // Shift+Tab reverses the same two-pane cycle rather than falling out of it.
    await user.tab({ shift: true });
    await waitFor(() => expect(providerRow).toHaveFocus());
  });

  it("keeps Tab native while focus sits outside both panes", async () => {
    const user = userEvent.setup();
    renderWithChrome(buildProps());

    const chromeControl = screen.getByRole("button", { name: "Before the panes" });
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    await user.click(chromeControl);
    expect(chromeControl).toHaveFocus();

    // The containers-scoped cycle declines here, so Tab walks into the page in
    // DOM order; a claimed Tab would have jumped straight to the context pane.
    await user.tab();
    expect(screen.getByRole("menu")).toHaveFocus();
  });

  it("stands the cycle down while a review is starting so Tab stays native", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const user = userEvent.setup();
    renderWithChrome(buildProps({ createReview }));

    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    await user.keyboard("r");
    await waitFor(() => expect(createReview).toHaveBeenCalled());

    // The start turns the sidebar inert, so a claimed Shift+Tab would land the
    // cycle in a pane with nothing to focus; native Tab walks out instead.
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before the panes" })).toHaveFocus();
  });

  it("leaves Tab native while the trust prompt replaces both panes", async () => {
    const user = userEvent.setup();
    renderPresentationWithApi(
      buildProps({ isTrusted: false, needsTrust: true, repoRoot: "/some/repo" }),
    );

    const action = await screen.findByRole("button", { name: "Trust & Continue" });
    // Neither pane is mounted, so a live cycle would claim Tab document-wide
    // and freeze focus on the body it starts from.
    await user.tab();

    expect(action).toHaveFocus();
  });
});

describe("HomePagePresentation — pane arrow hop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const hopContext: HomeContextInfo = {
    ...baseContext,
    lastRunId: "12345678-1234-4123-8123-123456789abc",
    lastRunIssueCount: 2,
  };

  it("enters the context rows on ArrowLeft, skipping the static trust row, and stops at both ends", async () => {
    const user = userEvent.setup();
    renderPresentation(buildProps({ context: hopContext }));

    const providerRow = screen.getByRole("button", { name: "Configure provider settings" });
    const scopeRow = screen.getByRole("button", { name: "Choose files to review" });
    const lastRunRow = screen.getByRole("button", { name: /open last review/i });
    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(providerRow).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    expect(scopeRow).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(lastRunRow).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(lastRunRow).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    expect(providerRow).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(providerRow).toHaveFocus();
  });

  it("returns to the menu on ArrowRight with the highlight where it was left", async () => {
    const user = userEvent.setup();
    renderPresentation(buildProps({ context: hopContext, highlighted: "review-staged" }));

    const menu = screen.getByRole("menu");
    await waitFor(() => expect(menu).toHaveFocus());
    const highlightedRow = screen.getByRole("menuitem", { name: "Review Staged" });
    expect(menu).toHaveAttribute("aria-activedescendant", highlightedRow.id);

    await user.keyboard("{ArrowLeft}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Configure provider settings" })).toHaveFocus(),
    );

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(menu).toHaveFocus());
    expect(menu).toHaveAttribute("aria-activedescendant", highlightedRow.id);
  });

  it("walks the rows with the arrows after Tab reaches the pane", async () => {
    const user = userEvent.setup();
    renderPresentation(buildProps({ context: hopContext }));

    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    await user.tab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Configure provider settings" })).toHaveFocus(),
    );

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Choose files to review" })).toHaveFocus();
  });

  it("holds the arrow hop while a review is starting", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const user = userEvent.setup();
    renderPresentation(buildProps({ context: hopContext, createReview }));

    await waitFor(() => expect(screen.getByRole("menu")).toHaveFocus());
    await user.keyboard("r");
    await waitFor(() => expect(createReview).toHaveBeenCalled());

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("menu")).toHaveFocus();
  });
});

describe("HomePagePresentation — menu jump keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts an unstaged review from the advertised r key", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.keyboard("r");

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "unstaged" }));
  });

  it("starts a staged review from the advertised shifted R key", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview }));

    await user.keyboard("{Shift>}R{/Shift}");

    await waitFor(() => expect(createReview).toHaveBeenCalledWith({ mode: "staged" }));
  });

  it("resumes the cached session from the advertised l key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        resumableSession: { reviewId: "rev-unstaged", mode: "unstaged" },
        navigate: navigateMock.navigate,
      }),
    );

    await user.keyboard("l");

    expect(navigateMock.mock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/review/{-$reviewId}",
        params: { reviewId: "rev-unstaged" },
      }),
    );
  });

  it("opens the last run from the advertised o key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(
      buildProps({
        context: { ...baseContext, lastRunId: "rev-last", lastRunIssueCount: 4 },
        navigate: navigateMock.navigate,
      }),
    );

    await user.keyboard("o");

    expect(navigateMock.mock).toHaveBeenCalledWith({
      to: "/review/{-$reviewId}",
      params: { reviewId: "rev-last" },
    });
  });

  it("opens provider settings from the advertised p key", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ navigate: navigateMock.navigate }));

    await user.keyboard("p");

    expect(navigateMock.mock).toHaveBeenCalledWith({ to: "/settings/providers" });
  });

  it("opens trust permissions from the advertised t key while untrusted", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ isTrusted: false, navigate: navigateMock.navigate }));

    await user.keyboard("t");

    expect(navigateMock.mock).toHaveBeenCalledWith({ to: "/settings/trust-permissions" });
  });

  it("holds the sidebar jump keys while a review is starting", async () => {
    const createReview = vi.fn(() => new Promise<{ reviewId: string }>(() => {}));
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ createReview, navigate: navigateMock.navigate }));

    await user.keyboard("r");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/starting review/i));
    await user.keyboard("p");

    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("declines t once the repository is trusted instead of swallowing it", async () => {
    const navigateMock = createNavigateMock();
    const onFallthrough = vi.fn();
    const user = userEvent.setup();
    // Registered first, so it sits behind home's own binding in the dispatch
    // order and only runs if home declines the key.
    render(
      <>
        <TrustKeyProbe onPress={onFallthrough} />
        <HomePagePresentation {...buildProps({ navigate: navigateMock.navigate })} />
      </>,
      { wrapper: Wrapper },
    );

    await user.keyboard("t");

    expect(navigateMock.mock).not.toHaveBeenCalled();
    expect(onFallthrough).toHaveBeenCalledOnce();
  });

  it("leaves o inert when there is no previous run", async () => {
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    renderPresentation(buildProps({ navigate: navigateMock.navigate }));

    await user.keyboard("o");

    expect(navigateMock.mock).not.toHaveBeenCalled();
  });

  it("ignores the jump keys of items the menu renders as disabled", async () => {
    const createReview = vi.fn(async () => ({ reviewId: "rev-new" }));
    const navigateMock = createNavigateMock();
    const user = userEvent.setup();
    // Untrusted disables both review starts; no resumable session disables resume.
    renderPresentation(
      buildProps({ isTrusted: false, createReview, navigate: navigateMock.navigate }),
    );

    await user.keyboard("r");
    await user.keyboard("{Shift>}R{/Shift}");
    await user.keyboard("l");

    expect(createReview).not.toHaveBeenCalled();
    expect(navigateMock.mock).not.toHaveBeenCalled();
    expect(screen.queryByText("Repository Not Trusted")).not.toBeInTheDocument();
  });
});
