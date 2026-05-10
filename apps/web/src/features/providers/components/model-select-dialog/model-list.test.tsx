import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { ModelList } from "./model-list";

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

  it("keeps one tabbable radio while list keyboard navigation is active", () => {
    render(
      <ModelList
        models={MODELS}
        focusedModelId="model-a"
        currentModelId="model-a"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("tabindex")))
      .toEqual(["0", "-1"]);
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
