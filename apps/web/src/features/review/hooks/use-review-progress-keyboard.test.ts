import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
import { createElement, type ReactNode } from "react";
import { Footer, FooterProvider, useFooterData } from "@/components/layout";
import { useReviewProgressKeyboard } from "./use-review-progress-keyboard";

function FooterView() {
  const { shortcuts, rightShortcuts } = useFooterData();
  return createElement(Footer, { shortcuts, rightShortcuts });
}

function Subject({
  onViewResults,
  onCancel,
}: {
  onViewResults?: () => void;
  onCancel?: () => void;
}) {
  useReviewProgressKeyboard({ onViewResults, onCancel });
  return createElement(FooterView);
}

function renderSubject(props: {
  onViewResults?: () => void;
  onCancel?: () => void;
} = {}) {
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      KeyboardProvider,
      null,
      createElement(FooterProvider, null, children),
    );
  }
  return render(createElement(Subject, props), { wrapper: Wrapper });
}

describe("useReviewProgressKeyboard", () => {
  it("invokes the view-results handler when Enter is pressed outside an interactive target", async () => {
    const user = userEvent.setup();
    const onViewResults = vi.fn();

    renderSubject({ onViewResults });

    await user.keyboard("{Enter}");

    expect(onViewResults).toHaveBeenCalledTimes(1);
  });

  it("invokes the cancel handler when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderSubject({ onCancel });

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("publishes only the pane-switching hint when no callbacks are wired", () => {
    renderSubject();

    expect(screen.getByText("Switch Pane")).toBeInTheDocument();
    expect(screen.queryByText("View Results")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("publishes view-results and cancel hints when callbacks are wired", () => {
    renderSubject({ onViewResults: vi.fn(), onCancel: vi.fn() });

    expect(screen.getByText("Switch Pane")).toBeInTheDocument();
    expect(screen.getByText("View Results")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
