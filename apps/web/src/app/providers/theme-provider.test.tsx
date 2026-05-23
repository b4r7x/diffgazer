import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { ThemeProvider, ThemeContext } from "./theme-provider";
import type { ThemeContextValue } from "@/types/theme";

// Boundary mock: api/hooks is the HTTP-data fetch boundary; we provide canned data and assert on the resulting UI.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useSettings: vi.fn().mockReturnValue({
    data: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useSaveSettings: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

import { useSettings, useSaveSettings } from "@diffgazer/core/api/hooks";

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;
const mockUseSaveSettings = useSaveSettings as ReturnType<typeof vi.fn>;

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

function ThemeConsumer({
  onRender,
}: {
  onRender: (ctx: ThemeContextValue) => void;
}) {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;
  onRender(ctx);
  return null;
}

let mockMutate: ReturnType<typeof vi.fn>;

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockMatchMedia(false); // default: system theme = light
    mockMutate = vi.fn();
    mockUseSaveSettings.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
    });
    mockUseSettings.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    localStorageStore.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  it("applies the light theme when the user setting is light", () => {
    mockUseSettings.mockReturnValue({
      data: { theme: "light" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to the system preference when no user setting is present", () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies the dark theme when the system prefers dark", () => {
    mockMatchMedia(true); // system = dark
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("persists the chosen theme to localStorage and saves it through the API", async () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseSaveSettings.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });

    render(
      <ThemeProvider>
        <ThemeConsumer onRender={(ctx) => { capturedSetTheme = ctx.setTheme; }} />
      </ThemeProvider>
    );

    expect(capturedSetTheme).toBeDefined();
    await act(async () => {
      await capturedSetTheme!("dark");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("dark");
    expect(mockMutateAsync).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("applies the chosen theme immediately even when the settings cache is stale", () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;

    mockUseSettings.mockReturnValue({
      data: { theme: "auto" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeConsumer onRender={(ctx) => { capturedSetTheme = ctx.setTheme; }} />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      capturedSetTheme?.("dark");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("renders the 'terminal' settings theme as dark", () => {
    mockUseSettings.mockReturnValue({
      data: { theme: "terminal" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("reflects a system theme change while mounted", () => {
    const mediaQuery = mockMatchMedia(false);

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      mediaQuery.matches = true;
      matchMediaListeners.forEach((listener) => {
        listener({ matches: true, media: mediaQuery.media } as MediaQueryListEvent);
      });
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
