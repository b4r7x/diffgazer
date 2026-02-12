import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockNavigate = vi.fn();
const mockSetZone = vi.fn();
const keyHandlers = new Map<string, () => void>();
let mockZone: "timeline" | "runs" | "search" = "runs";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("keyscope", () => ({
  useFocusZone: (opts: { zone: string; onZoneChange?: (zone: string) => void }) => {
    mockZone = opts.zone as typeof mockZone;
    return {
      zone: mockZone,
      setZone: mockSetZone,
      inZone: (...zones: string[]) => zones.includes(mockZone),
      forZone: (zone: string, extra?: Record<string, unknown>) => ({
        ...extra,
        enabled: mockZone === zone && (extra?.enabled ?? true),
      }),
    };
  },
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

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: vi.fn(),
}));

import { getHistoryFooter, useHistoryKeyboard } from "./use-history-keyboard";

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

function renderSubject(overrides: Partial<Parameters<typeof useHistoryKeyboard>[0]> = {}) {
  const setFocusZone = vi.fn();
  const defaults: Parameters<typeof useHistoryKeyboard>[0] = {
    focusZone: mockZone,
    setFocusZone,
    selectedRunId: "run-1",
    searchInputRef: { current: null },
  };

  renderHook(() => useHistoryKeyboard({ ...defaults, ...overrides }));
  return { setFocusZone };
}

describe("useHistoryKeyboard", () => {
  beforeEach(() => {
    keyHandlers.clear();
    mockSetZone.mockReset();
    mockNavigate.mockReset();
  });

  describe("getHistoryFooter", () => {
    it("returns search shortcuts for search zone", () => {
      const result = getHistoryFooter("search");

      expect(result.shortcuts).toEqual([{ key: "↓", label: "Timeline" }]);
      expect(result.rightShortcuts).toEqual([{ key: "Esc", label: "Clear Search" }]);
    });

    it("returns timeline shortcuts for timeline zone", () => {
      const result = getHistoryFooter("timeline");

      expect(result.shortcuts).toContainEqual({ key: "Tab", label: "Switch Focus" });
      expect(result.shortcuts).toContainEqual({ key: "/", label: "Search" });
    });

    it("returns runs shortcuts for runs zone", () => {
      const result = getHistoryFooter("runs");

      expect(result.shortcuts).toContainEqual({ key: "o", label: "Open Review" });
      expect(result.shortcuts).toContainEqual({ key: "/", label: "Search" });
    });

    it("returns runs shortcuts for insights zone (maps to runs)", () => {
      const result = getHistoryFooter("insights");

      expect(result.shortcuts).toContainEqual({ key: "o", label: "Open Review" });
    });
  });

  describe("/ key focuses search", () => {
    it("sets focus zone to search when not in search zone", () => {
      mockZone = "runs";
      const { setFocusZone } = renderSubject({ focusZone: "runs" });

      press("/");

      expect(setFocusZone).toHaveBeenCalledWith("search");
    });

    it("does not register / handler when already in search zone", () => {
      mockZone = "search";
      renderSubject({ focusZone: "search" });

      expect(keyHandlers.has("/")).toBe(false);
    });
  });

  describe("run navigation", () => {
    it("o key navigates to selected run in runs zone", () => {
      mockZone = "runs";
      renderSubject({ focusZone: "runs", selectedRunId: "run-42" });

      press("o");

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/$reviewId",
        params: { reviewId: "run-42" },
      });
    });

    it("Space navigates to selected run in runs zone", () => {
      mockZone = "runs";
      renderSubject({ focusZone: "runs", selectedRunId: "run-42" });

      press(" ");

      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/review/$reviewId",
        params: { reviewId: "run-42" },
      });
    });

    it("does not navigate when selectedRunId is null", () => {
      mockZone = "runs";
      renderSubject({ focusZone: "runs", selectedRunId: null });

      press("o");

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it("Escape navigates back to home", () => {
    mockZone = "runs";
    renderSubject({ focusZone: "runs" });

    press("Escape");

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/" });
  });

  describe("effectiveZone", () => {
    it("maps insights to runs for useFocusZone", () => {
      // When focusZone is "insights", effectiveZone becomes "runs"
      // The mock's useFocusZone captures the zone prop, updating mockZone
      renderSubject({ focusZone: "insights" });

      // useFocusZone received zone="runs" (the mapped value)
      expect(mockZone).toBe("runs");
    });
  });
});
