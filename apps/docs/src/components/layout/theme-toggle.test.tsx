// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_INIT_SCRIPT, ThemeProvider, useTheme } from "@/hooks/theme-context";
import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ThemeToggle", () => {
  interface CommitSnapshot {
    label: string | null;
  }

  function executeThemeBootstrap() {
    // biome-ignore lint/security/noGlobalEval: executes the app's static, user-input-free bootstrap verbatim to verify its pre-hydration DOM contract.
    window.eval(THEME_INIT_SCRIPT);
  }

  function finishThemeBootstrap() {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  }

  it.each([
    { stored: undefined, expected: "dark", label: "missing preference" },
    { stored: "system", expected: "dark", label: "invalid preference" },
    { stored: "dark", expected: "dark", label: "dark preference" },
    { stored: "light", expected: "light", label: "light preference" },
  ])("bootstraps the exact theme for a $label", ({ stored, expected }) => {
    if (stored !== undefined) localStorage.setItem("@diffgazer/docs-theme", stored);

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", expected);
    finishThemeBootstrap();
  });

  it("falls back to dark when theme storage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage unavailable", "SecurityError");
    });

    executeThemeBootstrap();

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    finishThemeBootstrap();
    getItem.mockRestore();
  });

  it("bridges the visible SSR toggle to the bootstrapped light theme before hydration", async () => {
    const user = userEvent.setup();
    localStorage.setItem("@diffgazer/docs-theme", "light");
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
    expect(button).toHaveAttribute("aria-label", "Switch to light theme");
    expect(button).toHaveTextContent("light");
    document.body.append(container);

    await vi.waitFor(() => {
      expect(button).toHaveAttribute("aria-label", "Switch to dark theme");
      expect(button).toHaveTextContent("dark");
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
    expect(snapshots[0]).toEqual({ label: "Switch to dark theme" });
    expect(snapshots).not.toContainEqual({ label: "Switch to light theme" });
    expect(screen.getByRole("button", { name: /switch to dark theme/i })).toBeEnabled();
    expect(hydrationErrors).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("@diffgazer/docs-theme")).toBe("dark");
    expect(button).toHaveAttribute("aria-label", "Switch to light theme");
    expect(button).toHaveTextContent("light");
    expect(hydrationErrors).not.toHaveBeenCalled();

    view.unmount();
    hydrationErrors.mockRestore();
    container.remove();
  });

  it("toggles the document theme and persists the choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: /switch to light theme/i }));

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("@diffgazer/docs-theme")).toBe("light");

    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("@diffgazer/docs-theme")).toBe("dark");
  });
});
