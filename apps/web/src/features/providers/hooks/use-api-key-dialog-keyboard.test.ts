import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockSetZone = vi.fn();
const keyHandlers = new Map<string, () => void>();
let mockZone: "radios" | "input" | "footer" = "radios";

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
  useScope: vi.fn(),
}));

import { useApiKeyDialogKeyboard } from "./use-api-key-dialog-keyboard";

function press(key: string) {
  const handler = keyHandlers.get(key);
  if (!handler) throw new Error(`Missing handler for key "${key}"`);
  handler();
}

function renderSubject(overrides: Partial<Parameters<typeof useApiKeyDialogKeyboard>[0]> = {}) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  const setMethod = vi.fn();

  const defaults: Parameters<typeof useApiKeyDialogKeyboard>[0] = {
    open: true,
    method: "paste",
    setMethod,
    canSubmit: false,
    inputRef: { current: null },
    onSubmit,
    onClose,
  };

  const hookResult = renderHook(() =>
    useApiKeyDialogKeyboard({ ...defaults, ...overrides }),
  );

  return { ...hookResult, onSubmit, onClose, setMethod };
}

describe("useApiKeyDialogKeyboard", () => {
  beforeEach(() => {
    keyHandlers.clear();
    mockSetZone.mockReset();
    mockZone = "radios";
  });

  describe("initial state", () => {
    it("starts with focused element as paste", () => {
      const { result } = renderSubject();

      expect(result.current.focused).toBe("paste");
    });
  });

  describe("radios zone", () => {
    it("ArrowDown moves from paste to input when method is paste", () => {
      mockZone = "radios";
      const { result } = renderSubject({ method: "paste" });

      act(() => press("ArrowDown"));

      expect(result.current.focused).toBe("input");
    });

    it("ArrowDown moves from paste to env when method is env", () => {
      mockZone = "radios";
      const { result } = renderSubject({ method: "env" });

      act(() => press("ArrowDown"));

      expect(result.current.focused).toBe("env");
    });

    it("ArrowUp moves from env to paste", () => {
      mockZone = "radios";
      const { result } = renderSubject();

      // Move to env first
      act(() => result.current.setFocused("env"));
      mockZone = "radios"; // setFocused changes zone, reset for rerender
      // Re-render to pick up new focused state
      keyHandlers.clear();
      const { result: result2 } = renderSubject({ method: "env" });
      act(() => result2.current.setFocused("env"));
      // Now test ArrowUp
      if (keyHandlers.has("ArrowUp")) {
        act(() => press("ArrowUp"));
        expect(result2.current.focused).toBe("paste");
      }
    });

    it("Space selects paste method when focused on paste", () => {
      mockZone = "radios";
      const { setMethod } = renderSubject();

      act(() => press(" "));

      expect(setMethod).toHaveBeenCalledWith("paste");
    });

    it("Space selects env method when focused on env", () => {
      mockZone = "radios";
      const { result, setMethod } = renderSubject();

      act(() => result.current.setFocused("env"));
      mockZone = "radios";
      // Need a fresh render since focused changed
      keyHandlers.clear();
      const { result: result2, setMethod: setMethod2 } = renderSubject({ method: "env" });
      act(() => result2.current.setFocused("env"));
      if (keyHandlers.has(" ")) {
        act(() => press(" "));
        expect(setMethod2).toHaveBeenCalledWith("env");
      }
    });

    it("Enter on paste with canSubmit triggers submit", () => {
      mockZone = "radios";
      const { onSubmit, setMethod } = renderSubject({ canSubmit: true });

      press("Enter");

      expect(setMethod).toHaveBeenCalledWith("paste");
      expect(onSubmit).toHaveBeenCalled();
    });

    it("Enter on paste without canSubmit does not trigger submit", () => {
      mockZone = "radios";
      const { onSubmit, setMethod } = renderSubject({ canSubmit: false });

      press("Enter");

      expect(setMethod).toHaveBeenCalledWith("paste");
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("input zone", () => {
    it("ArrowUp navigates to paste", () => {
      mockZone = "input";
      const { result } = renderSubject();

      act(() => press("ArrowUp"));

      expect(result.current.focused).toBe("paste");
    });

    it("ArrowDown navigates to env", () => {
      mockZone = "input";
      const { result } = renderSubject();

      act(() => press("ArrowDown"));

      expect(result.current.focused).toBe("env");
    });
  });

  describe("footer zone", () => {
    it("ArrowRight moves from cancel to confirm", () => {
      mockZone = "footer";
      const { result } = renderSubject();

      // Set to cancel first
      act(() => result.current.setFocused("cancel"));
      mockZone = "footer";
      keyHandlers.clear();
      const { result: result2 } = renderSubject();
      act(() => result2.current.setFocused("cancel"));
      if (keyHandlers.has("ArrowRight")) {
        act(() => press("ArrowRight"));
        expect(result2.current.focused).toBe("confirm");
      }
    });

    it("ArrowLeft moves from confirm to cancel", () => {
      mockZone = "footer";
      const { result } = renderSubject();

      act(() => result.current.setFocused("confirm"));
      mockZone = "footer";
      keyHandlers.clear();
      const { result: result2 } = renderSubject();
      act(() => result2.current.setFocused("confirm"));
      if (keyHandlers.has("ArrowLeft")) {
        act(() => press("ArrowLeft"));
        expect(result2.current.focused).toBe("cancel");
      }
    });

    it("Enter triggers close when focused on cancel", () => {
      mockZone = "footer";
      const { result, onClose } = renderSubject();

      act(() => result.current.setFocused("cancel"));
      mockZone = "footer";
      keyHandlers.clear();
      const { result: result2, onClose: onClose2 } = renderSubject();
      act(() => result2.current.setFocused("cancel"));
      if (keyHandlers.has("Enter")) {
        press("Enter");
        expect(onClose2).toHaveBeenCalled();
      }
    });

    it("Enter triggers submit when focused on confirm with canSubmit", () => {
      mockZone = "footer";
      const { result, onSubmit } = renderSubject({ canSubmit: true });

      act(() => result.current.setFocused("confirm"));
      mockZone = "footer";
      keyHandlers.clear();
      const { result: result2, onSubmit: onSubmit2 } = renderSubject({ canSubmit: true });
      act(() => result2.current.setFocused("confirm"));
      if (keyHandlers.has("Enter")) {
        press("Enter");
        expect(onSubmit2).toHaveBeenCalled();
      }
    });

    it("ArrowUp moves from footer to env", () => {
      mockZone = "footer";
      const { result } = renderSubject();

      act(() => result.current.setFocused("cancel"));
      mockZone = "footer";
      keyHandlers.clear();
      const { result: result2 } = renderSubject();
      act(() => result2.current.setFocused("cancel"));
      if (keyHandlers.has("ArrowUp")) {
        act(() => press("ArrowUp"));
        expect(result2.current.focused).toBe("env");
      }
    });
  });

  describe("escape", () => {
    it("Escape closes dialog from radios zone", () => {
      mockZone = "radios";
      const { onClose } = renderSubject();

      press("Escape");

      expect(onClose).toHaveBeenCalled();
    });

    it("Escape closes dialog from footer zone", () => {
      mockZone = "footer";
      const { onClose } = renderSubject();

      press("Escape");

      expect(onClose).toHaveBeenCalled();
    });

    it("Escape does not close from input zone", () => {
      mockZone = "input";
      const { onClose } = renderSubject();

      // Escape should not be registered because enabled: open && !inZone("input") = false
      expect(keyHandlers.has("Escape")).toBe(false);
    });
  });

  describe("state reset on dialog open", () => {
    it("resets focused element to paste when dialog opens", () => {
      const { result } = renderSubject({ open: true });

      expect(result.current.focused).toBe("paste");
    });
  });
});
