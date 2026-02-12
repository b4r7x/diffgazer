import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockNavigate = vi.fn();
const mockSetZone = vi.fn();
const keyHandlers = new Map<string, () => void>();
let mockZone: "input" | "filters" | "list" | "buttons" = "list";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("keyscope", () => ({
  useFocusZone: () => ({
    zone: mockZone,
    setZone: mockSetZone,
    inZone: (...zones: string[]) => zones.includes(mockZone),
    forZone: (zone: string, extra?: Record<string, unknown>) => ({
      ...extra,
      enabled: mockZone === zone && (extra?.enabled ?? true),
    }),
  }),
  useKey: (
    keyOrHandlers: string | Record<string, () => void>,
    handlerOrOptions?: (() => void) | { enabled?: boolean },
    maybeOptions?: { enabled?: boolean },
  ) => {
    if (typeof keyOrHandlers === "string") {
      const options = maybeOptions ?? (typeof handlerOrOptions === "object" ? handlerOrOptions : undefined);
      if ((options as { enabled?: boolean })?.enabled === false) return;
      keyHandlers.set(keyOrHandlers, handlerOrOptions as () => void);
    } else {
      const options = handlerOrOptions as { enabled?: boolean } | undefined;
      if (options?.enabled === false) return;
      for (const [key, handler] of Object.entries(keyOrHandlers)) {
        keyHandlers.set(key, handler);
      }
    }
  },
}));

import { useProvidersKeyboard } from "./use-providers-keyboard";

function renderSubject(overrides: Partial<Parameters<typeof useProvidersKeyboard>[0]> = {}) {
  const setSelectedId = vi.fn();
  const defaultArgs: Parameters<typeof useProvidersKeyboard>[0] = {
    selectedId: "gemini",
    selectedProvider: { id: "gemini", hasApiKey: false, model: "gemini-2.5-flash", name: "Gemini" },
    filteredProviders: [{ id: "gemini" }, { id: "zai" }],
    filter: "all",
    setFilter: vi.fn(),
    setSelectedId,
    dialogOpen: false,
    inputRef: { current: null },
    onSetApiKey: vi.fn(),
    onSelectModel: vi.fn(),
    onRemoveKey: vi.fn(async () => {}),
    onSelectProvider: vi.fn(async () => {}),
  };

  renderHook(() => useProvidersKeyboard({ ...defaultArgs, ...overrides }));
  return { setSelectedId };
}

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

describe("useProvidersKeyboard", () => {
  beforeEach(() => {
    keyHandlers.clear();
    mockSetZone.mockReset();
    mockNavigate.mockReset();
  });

  it("keeps current provider when moving from buttons back to list", () => {
    mockZone = "buttons";
    const { setSelectedId } = renderSubject();

    press("ArrowLeft");

    expect(mockSetZone).toHaveBeenCalledWith("list");
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  it("still focuses first provider when moving from filters down to list", () => {
    mockZone = "filters";
    const { setSelectedId } = renderSubject({
      filteredProviders: [{ id: "openrouter" }, { id: "zai" }],
    });

    press("ArrowDown");

    expect(mockSetZone).toHaveBeenCalledWith("list");
    expect(setSelectedId).toHaveBeenCalledWith("openrouter");
  });
});
