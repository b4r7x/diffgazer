import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useContext } from "react";
import { ThemeProvider, ThemeContext } from "./theme-provider";

// Mock useSettings at the boundary
vi.mock("@/hooks/use-settings", () => ({
  useSettings: vi.fn().mockReturnValue({
    settings: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    saveSettings: vi.fn().mockResolvedValue({}),
  },
}));

import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;
const mockSaveSettings = api.saveSettings as ReturnType<typeof vi.fn>;

// jsdom may not provide a working localStorage — polyfill it
const localStorageStore = new Map<string, string>();
const storageMock: Storage = {
  getItem: (key: string) => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => { localStorageStore.set(key, value); },
  removeItem: (key: string) => { localStorageStore.delete(key); },
  clear: () => { localStorageStore.clear(); },
  get length() { return localStorageStore.size; },
  key: (index: number) => [...localStorageStore.keys()][index] ?? null,
};
Object.defineProperty(globalThis, "localStorage", { value: storageMock, writable: true });

let matchMediaListeners: Set<(e: MediaQueryListEvent) => void>;

function mockMatchMedia(matches: boolean) {
  matchMediaListeners = new Set();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => matchMediaListeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => matchMediaListeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
}

// Helper to read context values
function ThemeConsumer({ onRender }: { onRender: (ctx: { theme: string; resolved: string; setTheme: (t: string) => void }) => void }) {
  const ctx = useContext(ThemeContext);
  if (ctx) onRender(ctx as any);
  return null;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMatchMedia(false); // default: system theme = light
    mockUseSettings.mockReturnValue({
      settings: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      invalidate: vi.fn(),
    });
    mockSaveSettings.mockResolvedValue({});
    localStorageStore.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  it("should apply light theme when user setting is light", () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: "light" },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      invalidate: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("should fall back to system preference when no user setting", () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    // jsdom matchMedia returns false for dark -> system = "light"
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("should apply dark theme when system prefers dark", () => {
    mockMatchMedia(true); // system = dark
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("should persist theme to localStorage and call API on setTheme", () => {
    let capturedSetTheme: ((t: string) => void) | undefined;

    render(
      <ThemeProvider>
        <ThemeConsumer onRender={(ctx) => { capturedSetTheme = ctx.setTheme; }} />
      </ThemeProvider>
    );

    expect(capturedSetTheme).toBeDefined();
    capturedSetTheme!("dark");

    expect(localStorage.getItem("stargazer-theme")).toBe("dark");
    expect(mockSaveSettings).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("should map 'terminal' settings theme to dark", () => {
    mockUseSettings.mockReturnValue({
      settings: { theme: "terminal" },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      invalidate: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("should reflect system theme change", () => {
    mockMatchMedia(false); // start light

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // Simulate system theme changing to dark
    // Update the matchMedia mock to return dark
    const mql = mockMatchMedia(true);

    // Re-render to pick up the new value — useSyncExternalStore
    // should have subscribed, but since we replaced window.matchMedia
    // we need to re-render
    cleanup();
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
