import { LIVE_ONLY_MODEL_DESCRIPTION } from "@diffgazer/core/providers";
import type { ModelInfo } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModelList } from "./list";

const DISCOVERED_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    description: "Exact credentialed production-path evidence passed.",
    tier: "paid",
  },
  // Upstream publishes no display name for this one, so the transform falls the
  // name back to the id and the row must not print it twice.
  {
    id: "gemini-2.5-pro",
    name: "gemini-2.5-pro",
    description: "Second exact model",
    tier: "free",
  },
];

const LIST_PROPS = {
  focusedModelId: "gemini-2.5-flash",
  currentModelId: "gemini-2.5-flash",
  isFocused: false,
  onSelect: vi.fn(),
  onConfirm: vi.fn(),
  onHighlightChange: vi.fn(),
  onBoundaryReached: vi.fn(),
};

describe("ModelList endpoint pools", () => {
  const POOL_MODELS: ModelInfo[] = [
    {
      id: "deepseek-v4-flash",
      name: "deepseek-v4-flash",
      description: "Served by both pools",
      tier: "paid",
      endpointProfileIds: ["zen", "go"],
    },
    {
      id: "claude-opus-5",
      name: "claude-opus-5",
      description: "Zen only",
      tier: "paid",
      endpointProfileIds: ["zen"],
    },
    {
      id: "qwen3.7-max",
      name: "qwen3.7-max",
      description: "Go only",
      tier: "paid",
      endpointProfileIds: ["go"],
    },
    {
      id: "glm-5.3",
      name: "glm-5.3",
      description: "Membership unknown",
      tier: "unknown",
    },
  ];

  // The picker's active pool tab names the pool, so the rows never repeat it —
  // whatever pools the rows belong to, and whether or not the product has any.
  it("renders no pool badges on any row", () => {
    render(<ModelList models={POOL_MODELS} {...LIST_PROPS} />);

    expect(screen.getAllByRole("radio")).toHaveLength(POOL_MODELS.length);
    expect(screen.queryByText(/^(Zen|Go)$/)).not.toBeInTheDocument();
  });
});

describe("ModelList configuration-bound discovery", () => {
  it("labels each admitted model with its display name, exact ID, and access tier", () => {
    render(<ModelList models={DISCOVERED_MODELS} {...LIST_PROPS} />);

    expect(screen.getByText("Gemini 2.5 Flash")).toBeInTheDocument();
    expect(screen.getByText("gemini-2.5-flash")).toBeInTheDocument();
    expect(screen.getAllByText("gemini-2.5-pro")).toHaveLength(1);
    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();
    expect(screen.queryByText(/latest/i)).not.toBeInTheDocument();
  });

  it("shows no tier badge for a model the catalog does not price", () => {
    render(
      <ModelList
        models={[
          { id: "gemma-4-31b-it", name: "Gemma 4 31B IT", description: "", tier: "unknown" },
        ]}
        {...LIST_PROPS}
      />,
    );

    expect(screen.getByText("Gemma 4 31B IT")).toBeInTheDocument();
    expect(screen.queryByText(/^(FREE|PAID|UNKNOWN)$/)).not.toBeInTheDocument();
  });

  it("explains a live-only row the catalog has not priced on its secondary line", () => {
    render(
      <ModelList
        models={[
          {
            id: "glm-5.3",
            name: "glm-5.3",
            description: LIVE_ONLY_MODEL_DESCRIPTION,
            tier: "unknown",
          },
        ]}
        {...LIST_PROPS}
      />,
    );

    expect(screen.getByRole("radio", { name: /glm-5\.3/ })).toHaveTextContent(
      LIVE_ONLY_MODEL_DESCRIPTION,
    );
  });

  it("confirms the double-clicked exact model ID directly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ModelList
        models={DISCOVERED_MODELS}
        focusedModelId="gemini-2.5-flash"
        currentModelId="gemini-2.5-flash"
        isFocused
        onSelect={vi.fn()}
        onConfirm={onConfirm}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    await user.dblClick(screen.getByRole("radio", { name: /gemini-2\.5-pro/ }));

    expect(onConfirm).toHaveBeenCalledWith("gemini-2.5-pro");
  });

  it("focuses the highlighted radio when list keyboard navigation is active", async () => {
    render(
      <ModelList
        models={DISCOVERED_MODELS}
        focusedModelId="gemini-2.5-pro"
        currentModelId="gemini-2.5-flash"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /gemini-2\.5-pro/ })).toHaveFocus();
    });
  });

  it("announces generic empty copy once and never restates a discovery failure", () => {
    const props = {
      focusedModelId: null,
      currentModelId: undefined,
      isFocused: false,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onHighlightChange: vi.fn(),
      onBoundaryReached: vi.fn(),
    };

    const { rerender } = render(
      <ModelList models={[]} emptyLabel="No models available" {...props} />,
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getAllByText("No models available")).toHaveLength(1);
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();

    rerender(<ModelList models={[]} emptyLabel="No models match your search" {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("No models match your search");
  });

  it("shows a loading placeholder while discovery is still running", () => {
    render(
      <ModelList
        models={[]}
        loading
        emptyLabel="No models available"
        focusedModelId={null}
        isFocused={false}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading models...");
    expect(screen.queryByText("No models available")).not.toBeInTheDocument();
  });

  it("keeps the disabled model radios with the selection visible while persistence is pending", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ModelList
        models={DISCOVERED_MODELS}
        focusedModelId="gemini-2.5-flash"
        currentModelId="gemini-2.5-flash"
        isFocused
        isSaving
        onSelect={onSelect}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={vi.fn()}
      />,
    );

    const checkedRow = screen.getByRole("radio", { name: /gemini-2\.5-flash/ });
    expect(checkedRow).toBeChecked();
    expect(checkedRow).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("radio", { name: /gemini-2\.5-pro/ }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps the live status region mounted across the results→empty transition", () => {
    const props = {
      focusedModelId: "gemini-2.5-flash",
      currentModelId: "gemini-2.5-flash",
      isFocused: false,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onHighlightChange: vi.fn(),
      onBoundaryReached: vi.fn(),
    };

    const { rerender } = render(<ModelList models={DISCOVERED_MODELS} {...props} />);

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
      focusedModelId: "gemini-2.5-flash",
      currentModelId: "gemini-2.5-flash",
      isFocused: true,
      onSelect: vi.fn(),
      onConfirm: vi.fn(),
      onHighlightChange: vi.fn(),
      onBoundaryReached: vi.fn(),
    };
    const { rerender } = render(<ModelList models={DISCOVERED_MODELS} {...props} />);
    const focusedModel = screen.getByRole("radio", { name: /gemini-2\.5-flash/ });

    focusedModel.focus();
    expect(focusedModel).toHaveFocus();

    rerender(<ModelList models={[]} emptyLabel="No models match your search" {...props} />);

    expect(screen.queryByRole("radio", { name: /gemini-2\.5-flash/ })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No models match your search");
  });

  it("hands off focus on vertical boundary keys", async () => {
    const user = userEvent.setup();
    const onBoundaryReached = vi.fn();

    render(
      <ModelList
        models={DISCOVERED_MODELS}
        focusedModelId="gemini-2.5-flash"
        currentModelId="gemini-2.5-flash"
        isFocused
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onHighlightChange={vi.fn()}
        onBoundaryReached={onBoundaryReached}
      />,
    );

    screen.getByRole("radio", { name: /gemini-2\.5-flash/ }).focus();
    await user.keyboard("{ArrowUp}");
    expect(onBoundaryReached).toHaveBeenCalledWith("previous");

    onBoundaryReached.mockClear();
    screen.getByRole("radio", { name: /gemini-2\.5-pro/ }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onBoundaryReached).toHaveBeenCalledWith("next");
  });
});
