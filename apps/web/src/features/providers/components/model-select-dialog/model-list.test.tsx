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
      />,
    );

    await user.dblClick(screen.getByRole("radio", { name: /Model B/ }));

    expect(onConfirm).toHaveBeenCalledWith("model-b");
  });
});
