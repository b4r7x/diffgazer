import { stubControllableMatchMedia } from "@diffgazer/core/testing/match-media";
import { act, cleanup, render } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeContext, ThemeProvider } from "@/hooks/use-theme";
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

function mockMatchMedia(matches: boolean) {
  return stubControllableMatchMedia((query) =>
    query === "(prefers-color-scheme: dark)" ? matches : false,
  );
}

function ThemeConsumer({ onRender }: { onRender: (ctx: ThemeContextValue) => void }) {
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
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
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
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
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

  it("reflects a system theme change while mounted", () => {
    const mediaQuery = mockMatchMedia(false);

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      mediaQuery.setMatches(() => false);
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    act(() => {
      mediaQuery.setMatches((query) => query === "(prefers-color-scheme: dark)");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
