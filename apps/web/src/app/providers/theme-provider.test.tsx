import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";

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

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
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
    localStorage.clear();
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

    // jsdom matchMedia returns false for dark → system = "light"
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
});
