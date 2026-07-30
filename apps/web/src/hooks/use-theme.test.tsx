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

function ThemeConsumer({ onRender }: { onRender: (ctx: ThemeContextValue) => void }) {
  const ctx = useTheme();
  onRender(ctx);
  return null;
}

let mockMutate: ReturnType<typeof vi.fn>;

describe("ThemeProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it("applies the dark default when neither a setting nor a stored theme exists", () => {
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

  it("applies the persisted localStorage theme before settings arrive", () => {
    localStorageStore.set("diffgazer-theme", "light");

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("falls back to the default theme when storage reads are denied", () => {
    vi.spyOn(storageMock, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });

    render(
      <ThemeProvider>
        <div />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
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
      await setTheme("light");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("light");
    expect(mockMutateAsync).toHaveBeenCalledWith({ theme: "light" });
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
      await capturedSetTheme?.("light");
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({ theme: "light" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("normalizes a legacy auto settings theme to dark and still applies a new choice", () => {
    let capturedSetTheme: ThemeContextValue["setTheme"] | undefined;
    let renderedTheme: ThemeContextValue["theme"] | undefined;

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
            renderedTheme = ctx.theme;
          }}
        />
      </ThemeProvider>,
    );

    expect(renderedTheme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    act(() => {
      capturedSetTheme?.("light");
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("normalizes the terminal settings theme to dark", () => {
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

    expect(renderedTheme).toBe("dark");
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
      await expect(setTheme("light")).rejects.toThrow("Save failed");
    });

    expect(localStorage.getItem("diffgazer-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});
