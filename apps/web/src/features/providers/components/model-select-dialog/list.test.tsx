import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelList } from "./list";

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
