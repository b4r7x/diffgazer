import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GEMINI_MODEL_INFO } from "@diffgazer/core/schemas/config";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { ModelStep } from "./model-step";

const { openRouterState } = vi.hoisted(() => ({
  openRouterState: {
    models: [] as ModelInfo[],
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("@/hooks/use-openrouter-models", () => ({
  useOpenRouterModels: () => openRouterState,
}));

function makeModel(id: string, name: string): ModelInfo {
  return {
    id,
    name,
    description: `${name} description`,
    tier: "paid",
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("ModelStep", () => {
  it("commits the current selected static model when Enter is pressed", async () => {
    const geminiModels = Object.values(GEMINI_MODEL_INFO);
    const selectedModel = geminiModels.find(
      (model) => model.id !== geminiModels[0]?.id,
    );
    if (!selectedModel) throw new Error("ModelStep test needs at least two Gemini models");

    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ModelStep
        provider="gemini"
        value={selectedModel.id}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedModel.id);
  });

  it("commits the highlighted static model after keyboard navigation", async () => {
    const geminiModels = Object.values(GEMINI_MODEL_INFO);
    const selectedModel = geminiModels[0];
    const highlightedModel = geminiModels[1];
    if (!selectedModel || !highlightedModel) {
      throw new Error("ModelStep test needs at least two Gemini models");
    }

    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ModelStep
        provider="gemini"
        value={selectedModel.id}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedModel.name)) }).focus();
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onCommit).toHaveBeenCalledWith(highlightedModel.id);
  });

  it("commits the selected OpenRouter model after models load", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const selectedModel = makeModel("openrouter/model-b", "OpenRouter Model B");

    openRouterState.models = [];
    openRouterState.loading = true;
    openRouterState.error = null;

    const { rerender } = render(
      <ModelStep
        provider="openrouter"
        value={selectedModel.id}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    openRouterState.models = [
      makeModel("openrouter/model-a", "OpenRouter Model A"),
      selectedModel,
    ];
    openRouterState.loading = false;

    rerender(
      <ModelStep
        provider="openrouter"
        value={selectedModel.id}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    screen.getByRole("radio", { name: /OpenRouter Model B/ }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedModel.id);
  });
});
