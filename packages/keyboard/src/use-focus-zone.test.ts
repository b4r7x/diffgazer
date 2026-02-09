import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

let capturedKeyHandlers: Map<string, () => void>;
let lastScopeName: string | undefined;
let lastScopeEnabled: boolean | undefined;

vi.mock("./use-key", () => ({
  useKey: (key: string, handler: () => void, options?: { enabled?: boolean }) => {
    if (options?.enabled !== false) {
      capturedKeyHandlers.set(key, handler);
    }
  },
}));

vi.mock("./use-scope", () => ({
  useScope: (name: string, options?: { enabled?: boolean }) => {
    lastScopeName = name;
    lastScopeEnabled = options?.enabled;
  },
}));

import { useFocusZone } from "./use-focus-zone";

function simulateKey(key: string) {
  const handler = capturedKeyHandlers.get(key);
  if (handler) handler();
}

describe("useFocusZone", () => {
  beforeEach(() => {
    capturedKeyHandlers = new Map();
    lastScopeName = undefined;
    lastScopeEnabled = undefined;
  });

  describe("uncontrolled mode", () => {
    it("should use initial zone", () => {
      const { result } = renderHook(() =>
        useFocusZone({ initial: "main", zones: ["main", "sidebar"] }),
      );

      expect(result.current.zone).toBe("main");
    });

    it("should change zone via setZone", () => {
      const { result } = renderHook(() =>
        useFocusZone({ initial: "main", zones: ["main", "sidebar"] }),
      );

      act(() => result.current.setZone("sidebar"));
      expect(result.current.zone).toBe("sidebar");
    });

    it("should call onZoneChange when setZone is called", () => {
      const onZoneChange = vi.fn();
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          onZoneChange,
        }),
      );

      act(() => result.current.setZone("sidebar"));
      expect(onZoneChange).toHaveBeenCalledWith("sidebar");
    });
  });

  describe("inZone helper", () => {
    it("should return true when current zone matches", () => {
      const { result } = renderHook(() =>
        useFocusZone({ initial: "main", zones: ["main", "sidebar", "footer"] }),
      );

      expect(result.current.inZone("main")).toBe(true);
      expect(result.current.inZone("sidebar")).toBe(false);
    });

    it("should accept variadic args", () => {
      const { result } = renderHook(() =>
        useFocusZone({ initial: "main", zones: ["main", "sidebar", "footer"] }),
      );

      expect(result.current.inZone("main", "footer")).toBe(true);
      expect(result.current.inZone("sidebar", "footer")).toBe(false);
    });
  });

  describe("controlled mode", () => {
    it("should use zone prop instead of internal state", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          zone: "sidebar",
        }),
      );

      expect(result.current.zone).toBe("sidebar");
    });

    it("should call onZoneChange but not change zone internally", () => {
      const onZoneChange = vi.fn();
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          zone: "sidebar",
          onZoneChange,
        }),
      );

      act(() => result.current.setZone("main"));
      expect(onZoneChange).toHaveBeenCalledWith("main");
      // Still controlled by prop
      expect(result.current.zone).toBe("sidebar");
    });
  });

  describe("transitions", () => {
    it("registers only transition keys for the current zone", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          transitions: ({ zone, key }) => {
            if (zone === "main" && key === "ArrowRight") return "sidebar";
            if (zone === "sidebar" && key === "ArrowLeft") return "main";
            return null;
          },
        }),
      );

      expect(capturedKeyHandlers.has("ArrowRight")).toBe(true);
      expect(capturedKeyHandlers.has("ArrowLeft")).toBe(false);
      expect(capturedKeyHandlers.has("ArrowUp")).toBe(false);
      expect(capturedKeyHandlers.has("ArrowDown")).toBe(false);

      act(() => simulateKey("ArrowRight"));
      expect(result.current.zone).toBe("sidebar");
      expect(capturedKeyHandlers.has("ArrowLeft")).toBe(true);
    });

    it("should change zone on arrow key when transition returns new zone", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          transitions: ({ zone, key }) => {
            if (zone === "main" && key === "ArrowRight") return "sidebar";
            if (zone === "sidebar" && key === "ArrowLeft") return "main";
            return null;
          },
        }),
      );

      act(() => simulateKey("ArrowRight"));
      expect(result.current.zone).toBe("sidebar");

      act(() => simulateKey("ArrowLeft"));
      expect(result.current.zone).toBe("main");
    });

    it("should not change zone when transition returns null", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          transitions: () => null,
        }),
      );

      act(() => simulateKey("ArrowUp"));
      expect(result.current.zone).toBe("main");
    });

    it("should not change zone when transition returns zone not in zones array", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          transitions: () => "unknown" as "main",
        }),
      );

      act(() => simulateKey("ArrowRight"));
      expect(result.current.zone).toBe("main");
    });

    it("should call onZoneChange on transition in controlled mode", () => {
      const onZoneChange = vi.fn();
      renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          zone: "main",
          onZoneChange,
          transitions: ({ key }) => {
            if (key === "ArrowRight") return "sidebar";
            return null;
          },
        }),
      );

      act(() => simulateKey("ArrowRight"));
      expect(onZoneChange).toHaveBeenCalledWith("sidebar");
    });
  });

  describe("tab cycling", () => {
    it("should cycle through zones in order on Tab", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "a",
          zones: ["a", "b", "c"],
          tabCycle: ["a", "b", "c"],
        }),
      );

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("b");

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("c");

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("a");
    });

    it("should cycle using tabCycle order, not zones order", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "c",
          zones: ["a", "b", "c"],
          tabCycle: ["c", "a", "b"],
        }),
      );

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("a");

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("b");
    });
  });

  describe("scope integration", () => {
    it("should push scope when scope option is provided", () => {
      renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main"],
          scope: "review",
        }),
      );

      expect(lastScopeName).toBe("review");
      expect(lastScopeEnabled).toBe(true);
    });

    it("should not push scope when scope is not provided", () => {
      renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main"],
        }),
      );

      expect(lastScopeEnabled).toBe(false);
    });
  });

  describe("enabled flag", () => {
    it("should not register key handlers when disabled", () => {
      renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main", "sidebar"],
          enabled: false,
          transitions: ({ key }) => {
            if (key === "ArrowRight") return "sidebar";
            return null;
          },
        }),
      );

      expect(capturedKeyHandlers.size).toBe(0);
    });

    it("should not push scope when disabled", () => {
      renderHook(() =>
        useFocusZone({
          initial: "main",
          zones: ["main"],
          enabled: false,
          scope: "review",
        }),
      );

      expect(lastScopeEnabled).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should work with a single zone", () => {
      const { result } = renderHook(() =>
        useFocusZone({
          initial: "only",
          zones: ["only"],
          tabCycle: ["only"],
        }),
      );

      act(() => simulateKey("Tab"));
      expect(result.current.zone).toBe("only");
    });
  });
});
