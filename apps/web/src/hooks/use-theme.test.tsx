import { createDeferred } from "@diffgazer/core/testing/deferred";
import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";
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

import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";

const mockUseSettings = useSettings as ReturnType<typeof vi.fn>;
const mockUseSaveSettings = useSaveSettings as ReturnType<typeof vi.fn>;

const localStorageStore = new Map<string, string>();
const storageMock: Storage = {
  getItem: (key: string) => localStorageStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore.set(key, value);
  },
  removeItem: (key: string) => {
    localStorageStore.delete(key);
  },
  clear: () => {
    localStorageStore.clear();
  },
  get length() {
    return localStorageStore.size;
  },
  key: (index: number) => [...localStorageStore.keys()][index] ?? null,
};
Object.defineProperty(globalThis, "localStorage", { value: storageMock, writable: true });

function mockSettingsTheme(theme: string | null) {
  mockUseSettings.mockReturnValue({
    data: theme === null ? null : { theme },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

/**
 * The real mutation awaits its settings invalidation, so the settings cache
 * already carries the saved theme by the time `mutateAsync` resolves.
 */
function mockSaveSettingsRefetching() {
  const mutateAsync = vi.fn().mockImplementation(async ({ theme }: { theme: string }) => {
    mockSettingsTheme(theme);
  });
  mockUseSaveSettings.mockReturnValue({
    mutate: mockMutate,
    mutateAsync,
    isPending: false,
    error: null,
  });
  return mutateAsync;
}

function mockMatchMedia(matches: boolean) {
  return stubMatchMedia((query) => (query === "(prefers-color-scheme: dark)" ? matches : false));
}

function ThemeConsumer({ onRender }: { onRender: (ctx: ThemeContextValue) => void }) {
  const ctx = useTheme();
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
    document.documentElement.style.colorScheme = "";
    document.querySelector('meta[name="theme-color"]')?.remove();
    const themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = "#0d1117";
    document.head.append(themeColor);
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
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#ffffff",
    );
  });

  it("falls back to the system preference when no user setting is present", () => {
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies the persisted localStorage theme before settings arrive", () => {
    mockMatchMedia(true); // system = dark
    localStorageStore.set("diffgazer-theme", "light");

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to the system theme when storage reads are denied", () => {
    vi.spyOn(storageMock, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("prefers the saved settings theme over a stale localStorage value", () => {
    localStorageStore.set("diffgazer-theme", "dark");
    mockUseSettings.mockReturnValue({
      data: { theme: "light" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("applies the dark theme when the system prefers dark", () => {
    mockMatchMedia(true); // system = dark
    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#0d1117",
    );
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
        <ThemeConsumer
          onRender={(ctx) => {
            capturedSetTheme = ctx.setTheme;
          }}
        />
      </ThemeProvider>,
    );

    expect(capturedSetTheme).toBeDefined();
    const setTheme = capturedSetTheme;
    if (!setTheme) throw new Error("setTheme was not captured");
    await act(async () => {
      await setTheme("dark");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("dark");
    expect(mockMutateAsync).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("saves the chosen theme when storage writes are denied", async () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;
    const mockMutateAsync = vi.fn().mockResolvedValue(undefined);
    mockUseSaveSettings.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });
    vi.spyOn(storageMock, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    render(
      <ThemeProvider>
        <ThemeConsumer
          onRender={(ctx) => {
            capturedSetTheme = ctx.setTheme;
          }}
        />
      </ThemeProvider>,
    );

    await act(async () => {
      await capturedSetTheme?.("dark");
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ theme: "dark" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
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
        <ThemeConsumer
          onRender={(ctx) => {
            capturedSetTheme = ctx.setTheme;
          }}
        />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      capturedSetTheme?.("dark");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("resolves the terminal settings theme to auto", () => {
    let renderedTheme: ThemeContextValue["theme"] | undefined;
    mockUseSettings.mockReturnValue({
      data: { theme: "terminal" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <ThemeConsumer
          onRender={(context) => {
            renderedTheme = context.theme;
          }}
        />
      </ThemeProvider>,
    );

    expect(renderedTheme).toBe("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("rolls back the local theme override when persistence fails", async () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error("Save failed"));
    mockUseSaveSettings.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });
    vi.spyOn(storageMock, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    render(
      <ThemeProvider>
        <ThemeConsumer
          onRender={(ctx) => {
            capturedSetTheme = ctx.setTheme;
          }}
        />
      </ThemeProvider>,
    );

    const setTheme = capturedSetTheme;
    if (!setTheme) throw new Error("setTheme was not captured");

    await act(async () => {
      await expect(setTheme("dark")).rejects.toThrow("Save failed");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("keeps the newer theme when an older save fails after it", async () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;
    const slowSave = createDeferred<void>();
    const mockMutateAsync = vi
      .fn()
      .mockReturnValueOnce(slowSave.promise)
      .mockResolvedValue(undefined);
    mockUseSaveSettings.mockReturnValue({
      mutate: mockMutate,
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
    });

    render(
      <ThemeProvider>
        <ThemeConsumer
          onRender={(ctx) => {
            capturedSetTheme = ctx.setTheme;
          }}
        />
      </ThemeProvider>,
    );

    let firstSave: Promise<void> | undefined;
    act(() => {
      firstSave = capturedSetTheme?.("dark");
    });
    await act(async () => {
      await capturedSetTheme?.("light");
    });

    // The stale failure must not drag the applied theme back to dark.
    await act(async () => {
      slowSave.reject(new Error("Save failed"));
      await expect(firstSave).rejects.toThrow("Save failed");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("live-updates the applied theme when the system preference flips while Auto is selected", () => {
    const media = mockMatchMedia(false);
    mockUseSettings.mockReturnValue({
      data: { theme: "auto" },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // No remount and no reload: the mounted tree repaints straight off the
    // media-query subscription.
    act(() => {
      media.setMatches((query) => query === "(prefers-color-scheme: dark)");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#0d1117",
    );
  });

  it("resolves a persisted auto config through the system and round-trips Auto/Dark/Light", async () => {
    const mockMutateAsync = mockSaveSettingsRefetching();
    mockSettingsTheme("auto");

    let context: ThemeContextValue | undefined;
    render(
      <ThemeProvider>
        <ThemeConsumer
          onRender={(ctx) => {
            context = ctx;
          }}
        />
      </ThemeProvider>,
    );

    // The system prefers light, so a persisted "auto" must resolve to light
    // rather than silently degrading to dark.
    expect(context?.theme).toBe("auto");
    expect(context?.resolved).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await act(async () => {
      await context?.setTheme("dark");
    });
    expect(context?.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await act(async () => {
      await context?.setTheme("light");
    });
    expect(context?.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await act(async () => {
      await context?.setTheme("auto");
    });
    expect(context?.theme).toBe("auto");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("diffgazer-theme")).toBe("auto");
    expect(mockMutateAsync).toHaveBeenLastCalledWith({ theme: "auto" });
  });

  it("adopts a theme another surface saved after this tab's own pick settled", async () => {
    mockSaveSettingsRefetching();
    mockSettingsTheme("auto");

    let context: ThemeContextValue | undefined;
    const consumer = () => (
      <ThemeProvider>
        <ThemeConsumer
          onRender={(ctx) => {
            context = ctx;
          }}
        />
      </ThemeProvider>
    );
    const { rerender } = render(consumer());

    await act(async () => {
      await context?.setTheme("dark");
    });
    expect(context?.theme).toBe("dark");

    // A second tab or the TUI writes "light"; the refetched settings must reach
    // this tab instead of staying shadowed by its own pick.
    mockSettingsTheme("light");
    rerender(consumer());

    expect(context?.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
