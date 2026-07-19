import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModelList } from "./list";

vi.mock("@diffgazer/ui/components/badge", () => ({
  Badge: ({ children, variant }: { children: ReactNode; variant: string }) => (
    <span data-tone={variant}>{children}</span>
  ),
}));

const MODELS: ModelInfo[] = [
  {
    id: "model-a",
    name: "Model A",
    description: "First model",
    tier: "paid",
  },
  {
    id: "model-b",
    name: "Model B",
    description: "Second model",
    tier: "free",
  },
];

describe("ModelList", () => {
  it("presents free tiers as informational and paid tiers as neutral", () => {
    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused={false}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    expect(screen.getByText("free")).toHaveAttribute("data-tone", "info");
    expect(screen.getByText("paid")).toHaveAttribute("data-tone", "neutral");
  });

  it("confirms the double-clicked model directly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused
        onSelect={vi.fn()}
        onConfirm={onConfirm}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    await user.dblClick(screen.getByRole("radio", { name: /Model B/ }));

    expect(onConfirm).toHaveBeenCalledWith("model-b");
  });

  it("focuses the highlighted radio when list keyboard navigation is active", async () => {
    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-b"
        currentModelId="model-a"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /Model B/ })).toHaveFocus();
    });
  });

  it("does not hand off focus on horizontal boundary keys", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={onBoundaryReached}
      />,
    );

    screen.getByRole("radio", { name: /Model A/ }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(onBoundaryReached).not.toHaveBeenCalled();

    screen.getByRole("radio", { name: /Model B/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onBoundaryReached).not.toHaveBeenCalled();
  });

  it("shows a saving placeholder instead of model radios while persistence is pending", () => {
    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused
        isSaving
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    expect(screen.getByText("Saving...")).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Model A/ })).not.toBeInTheDocument();
  });

  it("keeps the live status region mounted across the results→empty transition", () => {
    const props = {
      focusedModelId: "model-a",
      currentModelId: "model-a",
      isFocused: false,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onHighlightChange: vi.fn(),
      onBoundaryReached: vi.fn(),
    };

    const { rerender } = render(<ModelList models={MODELS} {...props} />);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveTextContent("");
    expect(liveRegion).toHaveClass("sr-only");

    rerender(<ModelList models={[]} emptyLabel="No models match your search" {...props} />);

    expect(screen.getByRole("status")).toBe(liveRegion);
    expect(liveRegion).toHaveTextContent("No models match your search");
    expect(liveRegion).not.toHaveClass("sr-only");
  });

  it("removes focused model controls when the results become empty", () => {
    const props = {
      focusedModelId: "model-a",
      currentModelId: "model-a",
      isFocused: true,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onHighlightChange: vi.fn(),
      onBoundaryReached: vi.fn(),
    };
    const { rerender } = render(<ModelList models={MODELS} {...props} />);
    const focusedModel = screen.getByRole("radio", { name: /Model A/ });

    focusedModel.focus();
    expect(focusedModel).toHaveFocus();

    rerender(<ModelList models={[]} emptyLabel="No models match your search" {...props} />);

    expect(screen.queryByRole("radio", { name: /Model A/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No models match your search");
  });

  it("hands off focus on vertical boundary keys", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={onBoundaryReached}
      />,
    );

    screen.getByRole("radio", { name: /Model A/ }).focus();
    await user.keyboard("{ArrowUp}");
    expect(onBoundaryReached).toHaveBeenCalledWith("previous");

    onBoundaryReached.mockClear();
    screen.getByRole("radio", { name: /Model B/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onBoundaryReached).toHaveBeenCalledWith("next");
  });
});
