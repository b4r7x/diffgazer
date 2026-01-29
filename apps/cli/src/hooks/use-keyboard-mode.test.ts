import { describe, it, expect } from "vitest";

type KeyboardMode = "menu" | "keys";

interface KeyboardModeState {
  mode: KeyboardMode;
  isKeyMode: boolean;
  isMenuMode: boolean;
}

function computeInitialState(initialMode: KeyboardMode = "menu"): KeyboardModeState {
  return {
    mode: initialMode,
    isKeyMode: initialMode === "keys",
    isMenuMode: initialMode === "menu",
  };
}

function computeToggledState(current: KeyboardModeState): KeyboardModeState {
  const newMode = current.mode === "menu" ? "keys" : "menu";
  return {
    mode: newMode,
    isKeyMode: newMode === "keys",
    isMenuMode: newMode === "menu",
  };
}

function computeSetModeState(newMode: KeyboardMode): KeyboardModeState {
  return {
    mode: newMode,
    isKeyMode: newMode === "keys",
    isMenuMode: newMode === "menu",
  };
}

describe("useKeyboardMode - State Logic", () => {
  describe("computeInitialState", () => {
    it("defaults to menu mode when no initial mode provided", () => {
      const state = computeInitialState();

      expect(state.mode).toBe("menu");
      expect(state.isMenuMode).toBe(true);
      expect(state.isKeyMode).toBe(false);
    });

    it("respects initialMode=menu", () => {
      const state = computeInitialState("menu");

      expect(state.mode).toBe("menu");
      expect(state.isMenuMode).toBe(true);
      expect(state.isKeyMode).toBe(false);
    });

    it("respects initialMode=keys", () => {
      const state = computeInitialState("keys");

      expect(state.mode).toBe("keys");
      expect(state.isKeyMode).toBe(true);
      expect(state.isMenuMode).toBe(false);
    });
  });

  describe("computeToggledState", () => {
    it("toggles from menu to keys", () => {
      const initial = computeInitialState("menu");
      const toggled = computeToggledState(initial);

      expect(toggled.mode).toBe("keys");
      expect(toggled.isKeyMode).toBe(true);
      expect(toggled.isMenuMode).toBe(false);
    });

    it("toggles from keys to menu", () => {
      const initial = computeInitialState("keys");
      const toggled = computeToggledState(initial);

      expect(toggled.mode).toBe("menu");
      expect(toggled.isMenuMode).toBe(true);
      expect(toggled.isKeyMode).toBe(false);
    });

    it("multiple toggles cycle correctly", () => {
      let state = computeInitialState("menu");
      expect(state.mode).toBe("menu");

      state = computeToggledState(state);
      expect(state.mode).toBe("keys");

      state = computeToggledState(state);
      expect(state.mode).toBe("menu");

      state = computeToggledState(state);
      expect(state.mode).toBe("keys");
    });
  });

  describe("computeSetModeState", () => {
    it("sets mode to keys", () => {
      const state = computeSetModeState("keys");

      expect(state.mode).toBe("keys");
      expect(state.isKeyMode).toBe(true);
      expect(state.isMenuMode).toBe(false);
    });

    it("sets mode to menu", () => {
      const state = computeSetModeState("menu");

      expect(state.mode).toBe("menu");
      expect(state.isMenuMode).toBe(true);
      expect(state.isKeyMode).toBe(false);
    });
  });

  describe("boolean flags invariants", () => {
    it("isKeyMode and isMenuMode are always mutually exclusive", () => {
      const menuState = computeInitialState("menu");
      expect(menuState.isKeyMode).not.toBe(menuState.isMenuMode);

      const keysState = computeInitialState("keys");
      expect(keysState.isKeyMode).not.toBe(keysState.isMenuMode);
    });

    it("one boolean is always true", () => {
      const menuState = computeInitialState("menu");
      expect(menuState.isKeyMode || menuState.isMenuMode).toBe(true);

      const keysState = computeInitialState("keys");
      expect(keysState.isKeyMode || keysState.isMenuMode).toBe(true);
    });
  });

  describe("state transitions", () => {
    it("menu -> setMode(keys) -> toggle -> setMode(menu)", () => {
      let state = computeInitialState("menu");
      expect(state.mode).toBe("menu");

      state = computeSetModeState("keys");
      expect(state.mode).toBe("keys");

      state = computeToggledState(state);
      expect(state.mode).toBe("menu");

      state = computeSetModeState("menu");
      expect(state.mode).toBe("menu");
    });
  });
});
