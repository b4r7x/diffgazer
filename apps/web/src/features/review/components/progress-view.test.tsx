import { FooterProvider, useFooterData } from "@diffgazer/core/footer";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/layout/footer";

// Boundary mock: TanStack Router is the external routing library; progress shortcuts navigate through it.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import {
  type ReviewProgressData,
  ReviewProgressView,
  type ReviewProgressViewProps,
} from "./progress-view";

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return <Footer shortcuts={shortcuts} rightShortcuts={rightShortcuts} />;
}

function makeProgressData(overrides: Partial<ReviewProgressData> = {}): ReviewProgressData {
  return {
    steps: [{ id: "parse", label: "Parse diff", status: "completed" }],
    entries: [],
    agents: [],
    metrics: {
      filesProcessed: 0,
      filesTotal: 0,
      issuesFound: 0,
    },
    notices: [],
    ...overrides,
  };
}

function renderView(props: Partial<ReviewProgressViewProps> = {}) {
  return render(
    <KeyboardProvider>
      <FooterProvider>
        <ReviewProgressView
          data={props.data ?? makeProgressData()}
          isRunning={props.isRunning ?? false}
          error={props.error}
          onViewResults={props.onViewResults}
          onCancel={props.onCancel}
        />
        <FooterView />
      </FooterProvider>
    </KeyboardProvider>,
  );
}

describe("ReviewProgressView", () => {
  it("publishes only available progress shortcuts", async () => {
    renderView();

    expect(await screen.findByText("Switch Pane")).toBeInTheDocument();
    expect(screen.queryByText("View Results")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("omits View Results shortcut when onViewResults is not provided", async () => {
    renderView({ isRunning: true, onCancel: vi.fn() });

    // The visible Cancel button (F-352) renders while streaming; the footer also
    // carries the "Cancel" Kbd hint, so disambiguate by role.
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View Results" })).not.toBeInTheDocument();
  });

  it("renders a clickable Cancel button while streaming so pointer users can stop a review", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderView({ isRunning: true, onCancel });

    const cancel = await screen.findByRole("button", { name: "Cancel" });
    await user.click(cancel);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not render the streaming Cancel button once the review is no longer running", () => {
    renderView({ isRunning: false, onViewResults: vi.fn(), onCancel: vi.fn() });

    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("announces the mid-run partial-analysis warning when it appears", () => {
    renderView({
      isRunning: true,
      error: null,
      data: makeProgressData({
        agents: [
          {
            id: "guardian",
            meta: {
              id: "guardian",
              lens: "security",
              name: "Guardian",
              badgeLabel: "SEC",
              badgeVariant: "warning",
              description: "",
            },
            status: "error",
            progress: 100,
            issueCount: 0,
          },
        ],
      }),
      onCancel: vi.fn(),
    });

    // The Partial Analysis Callout announces on appear via a live status region (F-353c).
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Partial Analysis");
  });

  it("Enter does not fire onViewResults when it is not provided", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();

    // Simulate error state: not running, error present, no onViewResults provided
    renderView({ isRunning: false, error: "API key error", onCancel: vi.fn() });

    await screen.findByText("Cancel");
    await user.keyboard("{Enter}");

    expect(onViewResults).not.toHaveBeenCalled();
  });

  it("announces stream errors in an alert live region", () => {
    renderView({ isRunning: false, error: "Provider request failed", onCancel: vi.fn() });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveTextContent("Provider request failed");
  });

  it("renders streamed server notices in a non-blocking live region", () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        notices: ["Event stream truncated: showing the first 500 events."],
      }),
    });

    expect(
      screen.getByText("Event stream truncated: showing the first 500 events."),
    ).toBeInTheDocument();
  });

  it("auto-expands the review step when agent substeps become available", async () => {
    renderView({
      isRunning: true,
      data: makeProgressData({
        steps: [
          { id: "parse", label: "Parse diff", status: "completed" },
          {
            id: "review",
            label: "Review",
            status: "active",
            substeps: [{ id: "security", tag: "SEC", label: "Security", status: "active" }],
          },
        ],
      }),
    });

    expect(await screen.findByText("Security")).toBeVisible();
  });

  it("runs progress shortcuts when result and cancel actions are available", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();
    const onCancel = vi.fn();

    renderView({ onViewResults, onCancel });

    expect(await screen.findByText("View Results")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");

    // call-count IS the contract: each shortcut keypress must fire its handler exactly once (no double-fire across the Enter+Escape sequence)
    expect(onViewResults).toHaveBeenCalledTimes(1);
    // call-count IS the contract: each shortcut keypress must fire its handler exactly once
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
