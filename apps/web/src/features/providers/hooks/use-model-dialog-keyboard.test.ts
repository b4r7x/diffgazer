import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockSetZone = vi.fn();
const keyHandlers = new Map<string, () => void>();
let mockZone: "search" | "filters" | "list" | "footer" = "list";

vi.mock("keyscope", () => ({
  useFocusZone: () => ({
    zone: mockZone,
    setZone: (zone: string) => {
      mockZone = zone as typeof mockZone;
      mockSetZone(zone);
    },
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
  useNavigation: (opts: {
    enabled?: boolean;
    onBoundaryReached?: (dir: string) => void;
    onSelect?: (id: string) => void;
    onEnter?: (id: string) => void;
  }) => ({
    focusedValue: "model-1",
    focus: vi.fn(),
  }),
}));

import { useModelDialogKeyboard } from "./use-model-dialog-keyboard";
import type { ModelInfo } from "@diffgazer/schemas/config";

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

const testModels: ModelInfo[] = [
  { id: "model-1", name: "Model 1", contextLength: 8192, tier: "free" },
  { id: "model-2", name: "Model 2", contextLength: 16384, tier: "paid" },
  { id: "model-3", name: "Model 3", contextLength: 32768, tier: "free" },
];

function renderSubject(overrides: Partial<Parameters<typeof useModelDialogKeyboard>[0]> = {}) {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const setSearchQuery = vi.fn();
  const setTierFilter = vi.fn();
  const cycleTierFilter = vi.fn();
  const resetFilters = vi.fn();

  const defaults: Parameters<typeof useModelDialogKeyboard>[0] = {
    open: true,
    currentModel: "model-1",
    models: testModels,
    filteredModels: testModels,
    searchQuery: "",
    setSearchQuery,
    setTierFilter,
    cycleTierFilter,
    resetFilters,
    searchInputRef: { current: null },
    listContainerRef: { current: null },
    onSelect,
    onOpenChange,
  };

  const hookResult = renderHook(() =>
    useModelDialogKeyboard({ ...defaults, ...overrides }),
  );

  return { ...hookResult, onSelect, onOpenChange, setSearchQuery, setTierFilter, cycleTierFilter, resetFilters };
}

describe("useModelDialogKeyboard", () => {
  beforeEach(() => {
    keyHandlers.clear();
    mockSetZone.mockReset();
    mockZone = "list";
  });

  describe("initial state", () => {
    it("starts with list zone", () => {
      const { result } = renderSubject();

      expect(result.current.focusZone).toBe("list");
    });

    it("starts with footer button index 1", () => {
      const { result } = renderSubject();

      expect(result.current.footerButtonIndex).toBe(1);
    });
  });

  describe("search zone", () => {
    it("ArrowDown moves from search to filters", () => {
      mockZone = "search";
      renderSubject();

      press("ArrowDown");

      expect(mockSetZone).toHaveBeenCalledWith("filters");
    });
  });

  describe("filters zone", () => {
    it("ArrowLeft changes filter index with wrapping", () => {
      mockZone = "filters";
      const { result } = renderSubject();

      // filterIndex starts at 0, ArrowLeft wraps to 2
      act(() => press("ArrowLeft"));

      expect(result.current.filterIndex).toBe(2);
    });

    it("ArrowRight changes filter index", () => {
      mockZone = "filters";
      const { result } = renderSubject();

      // filterIndex starts at 0, ArrowRight goes to 1
      act(() => press("ArrowRight"));

      expect(result.current.filterIndex).toBe(1);
    });

    it("Space applies tier filter at current index", () => {
      mockZone = "filters";
      const { setTierFilter } = renderSubject();

      act(() => press(" "));

      // filterIndex=0 → TIER_FILTERS[0] = "all"
      expect(setTierFilter).toHaveBeenCalledWith("all");
    });

    it("Enter applies tier filter at current index", () => {
      mockZone = "filters";
      const { setTierFilter } = renderSubject();

      press("Enter");

      expect(setTierFilter).toHaveBeenCalledWith("all");
    });

    it("ArrowUp moves from filters to search", () => {
      mockZone = "filters";
      renderSubject();

      press("ArrowUp");

      expect(mockSetZone).toHaveBeenCalledWith("search");
    });

    it("ArrowDown moves from filters to list", () => {
      mockZone = "filters";
      renderSubject();

      press("ArrowDown");

      expect(mockSetZone).toHaveBeenCalledWith("list");
    });
  });

  describe("footer zone", () => {
    it("ArrowLeft sets footer button to 0", () => {
      mockZone = "footer";
      const { result } = renderSubject();

      act(() => press("ArrowLeft"));

      expect(result.current.footerButtonIndex).toBe(0);
    });

    it("ArrowRight sets footer button to 1", () => {
      mockZone = "footer";
      const { result } = renderSubject();

      // Set to 0 first, then right
      act(() => press("ArrowLeft"));
      act(() => press("ArrowRight"));

      expect(result.current.footerButtonIndex).toBe(1);
    });

    it("Enter on button 0 cancels dialog", () => {
      mockZone = "footer";
      const { result, onOpenChange } = renderSubject();

      act(() => press("ArrowLeft")); // footerButtonIndex = 0
      press("Enter");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("Enter on button 1 confirms selection", () => {
      mockZone = "footer";
      const { onSelect, onOpenChange } = renderSubject();

      press("Enter");

      // handleConfirm uses checkedModelId ?? focusedModelId
      expect(onSelect).toHaveBeenCalledWith("model-1");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("Space on button 0 cancels dialog", () => {
      mockZone = "footer";
      const { onOpenChange } = renderSubject();

      act(() => press("ArrowLeft")); // footerButtonIndex = 0
      act(() => press(" "));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("ArrowUp moves from footer to list", () => {
      mockZone = "footer";
      renderSubject();

      press("ArrowUp");

      expect(mockSetZone).toHaveBeenCalledWith("list");
    });
  });

  describe("global shortcuts", () => {
    it("/ key moves to search zone", () => {
      mockZone = "list";
      renderSubject();

      press("/");

      expect(mockSetZone).toHaveBeenCalledWith("search");
    });

    it("f key cycles tier filter", () => {
      mockZone = "list";
      const { cycleTierFilter } = renderSubject();

      press("f");

      expect(cycleTierFilter).toHaveBeenCalled();
    });

    it("Escape closes dialog", () => {
      mockZone = "list";
      const { onOpenChange } = renderSubject();

      press("Escape");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("handleConfirm", () => {
    it("selects the checked model and closes", () => {
      mockZone = "list";
      const { result, onSelect, onOpenChange } = renderSubject();

      act(() => result.current.setCheckedModelId("model-2"));
      act(() => result.current.handleConfirm());

      expect(onSelect).toHaveBeenCalledWith("model-2");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("state reset on dialog open", () => {
    it("resets filter and footer state when dialog opens", () => {
      mockZone = "list";
      const { result, resetFilters } = renderSubject({ open: true });

      expect(resetFilters).toHaveBeenCalled();
      expect(result.current.footerButtonIndex).toBe(1);
      expect(result.current.filterIndex).toBe(0);
    });
  });
});
