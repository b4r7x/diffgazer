import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { themeBootstrap } from "@/hooks/theme-bootstrap";
import {
  THEME_BOOTSTRAP_CONFIG,
  THEME_COLORS,
  ThemeProvider,
  themeToggleLabel,
  useTheme,
} from "@/hooks/theme-context";
import { ThemeToggle } from "./theme-toggle";

const STORAGE_KEY = "@diffgazer/docs-theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});

afterEach(() => {
  localStorage.clear();
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  vi.restoreAllMocks();
});

describe("ThemeToggle", () => {
  interface CommitSnapshot {
    label: string | null;
  }

  function executeThemeBootstrap() {
    themeBootstrap(THEME_BOOTSTRAP_CONFIG);
  }

  function finishThemeBootstrap() {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }

  it("bridges the visible SSR toggle to the bootstrapped light theme before hydration", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, "light");
    executeThemeBootstrap();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    const container = document.createElement("div");
    container.innerHTML = renderToString(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const button = container.querySelector("button");
    expect(button).not.toHaveAttribute("hidden");
    // The server can only render the default theme; the bootstrap corrects it.
    expect(button).toHaveAttribute("aria-label", themeToggleLabel("dark"));
    expect(button).toHaveTextContent("dark");
    document.body.append(container);

    await vi.waitFor(() => {
      expect(button).toHaveAttribute("aria-label", themeToggleLabel("light"));
      expect(button).toHaveTextContent("light");
    });
    finishThemeBootstrap();

    const sentinel = document.createElement("button");
    sentinel.dataset.docsThemeToggle = "";
    sentinel.setAttribute("aria-label", "Sentinel label");
    sentinel.textContent = "sentinel text";
    document.body.append(sentinel);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(sentinel).toHaveAttribute("aria-label", "Sentinel label");
    expect(sentinel).toHaveTextContent("sentinel text");
    sentinel.remove();

    const snapshots: CommitSnapshot[] = [];
    const hydrationErrors = vi.spyOn(console, "error").mockImplementation(() => {});

    function CommitProbe() {
      useTheme();
      useLayoutEffect(() => {
        const button = container.querySelector("button");
        snapshots.push({
          label: button?.getAttribute("aria-label") ?? null,
        });
      });
      return null;
    }

    const view = render(
      <ThemeProvider>
        <ThemeToggle />
        <CommitProbe />
      </ThemeProvider>,
      { container, hydrate: true },
    );

    await vi.waitFor(() => expect(snapshots.length).toBeGreaterThan(0));
    expect(snapshots[0]).toEqual({ label: themeToggleLabel("light") });
    expect(snapshots).not.toContainEqual({ label: themeToggleLabel("dark") });
    expect(screen.getByRole("button", { name: themeToggleLabel("light") })).toBeEnabled();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(hydrationErrors).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: themeToggleLabel("light") }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
    expect(button).toHaveAttribute("aria-label", themeToggleLabel("dark"));
    expect(button).toHaveTextContent("dark");
    expect(hydrationErrors).not.toHaveBeenCalled();

    view.unmount();
    hydrationErrors.mockRestore();
    container.remove();
  });

  it("announces the F2 binding on the control that performs it", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: themeToggleLabel("dark") })).toHaveAttribute(
      "aria-keyshortcuts",
      "F2",
    );
  });

  it("cycles between dark and light and persists each choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    // No stored theme: the site starts dark.
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    await user.click(screen.getByRole("button", { name: themeToggleLabel("dark") }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");

    await user.click(screen.getByRole("button", { name: themeToggleLabel("light") }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("repaints the browser chrome color for the active theme", async () => {
    const user = userEvent.setup();
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = THEME_COLORS.dark;
    document.head.append(meta);
    localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(meta).toHaveAttribute("content", THEME_COLORS.dark);

    await user.click(screen.getByRole("button", { name: themeToggleLabel("dark") }));

    expect(meta).toHaveAttribute("content", THEME_COLORS.light);
  });

  it("adopts a theme another tab stored, and stops on unmount", () => {
    const view = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    localStorage.setItem(STORAGE_KEY, "light");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "light" }));
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: themeToggleLabel("light") })).toBeInTheDocument();

    localStorage.setItem("unrelated-key", "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key", newValue: "dark" }));
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    view.unmount();
    localStorage.setItem(STORAGE_KEY, "dark");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: "dark" }));
    });

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("still advances the theme when persistence is blocked", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: themeToggleLabel("dark") }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(screen.getByRole("button", { name: themeToggleLabel("light") })).toBeInTheDocument();

    setItem.mockRestore();
  });
});
