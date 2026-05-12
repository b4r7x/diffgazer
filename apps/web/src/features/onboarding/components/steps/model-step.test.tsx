import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createApi, type BoundApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { GEMINI_MODEL_INFO } from "@diffgazer/core/schemas/config";
import type { OpenRouterModelsResponse } from "@diffgazer/core/schemas/config";
import { escapeRegExp } from "@/testing";
import { ModelStep } from "./model-step";

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
    const mockGetOpenRouterModels = vi.fn<() => Promise<OpenRouterModelsResponse>>();

    mockGetOpenRouterModels.mockResolvedValue({
      models: [
        {
          id: "openrouter/model-a",
          name: "OpenRouter Model A",
          description: "A description",
          contextLength: 128000,
          supportedParameters: ["response_format"],
          pricing: { prompt: "0", completion: "0" },
          isFree: false,
        },
        {
          id: "openrouter/model-b",
          name: "OpenRouter Model B",
          description: "B description",
          contextLength: 128000,
          supportedParameters: ["response_format"],
          pricing: { prompt: "0", completion: "0" },
          isFree: false,
        },
      ],
      fetchedAt: new Date().toISOString(),
      cached: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const api = {
      ...createApi({ baseUrl: "http://localhost" }),
      getOpenRouterModels: mockGetOpenRouterModels,
    } satisfies BoundApi;

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ApiProvider, { value: api }, children),
      );

    render(
      <ModelStep
        provider="openrouter"
        value="openrouter/model-b"
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /OpenRouter Model B/ })).toBeInTheDocument();
    });

    screen.getByRole("radio", { name: /OpenRouter Model B/ }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith("openrouter/model-b");
  });
});
