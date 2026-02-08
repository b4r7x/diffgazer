import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardProvider } from "@stargazer/keyboard";
import type { ResolvedTheme, WebTheme } from "@/types/theme";

const mockNavigate = vi.fn();
const mockSetTheme = vi.fn();
let mockTheme: { theme: WebTheme; resolved: ResolvedTheme };

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/hooks/use-page-footer", () => ({
  usePageFooter: () => {},
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    ...mockTheme,
    setTheme: mockSetTheme,
  }),
}));

import { SettingsThemePage } from "./page";

function hasClassToken(element: Element, token: string): boolean {
  return element.className.split(/\s+/).includes(token);
}

function renderPage() {
  return render(
    <KeyboardProvider>
      <SettingsThemePage />
    </KeyboardProvider>
  );
}

function getRadio(value: "auto" | "dark" | "light") {
  const radio = document.querySelector(`[role="radio"][data-value="${value}"]`);
  if (!radio) {
    throw new Error(`Missing radio with data-value="${value}"`);
  }
  return radio as HTMLElement;
}

describe("SettingsThemePage keyboard behavior", () => {
  beforeEach(() => {
    mockTheme = { theme: "auto", resolved: "light" };
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
    document.documentElement.setAttribute("data-theme", "dark");
  });

  it("moves focus independently from selection and reaches button zone at list boundary", () => {
    renderPage();

    const autoRadio = getRadio("auto");
    const darkRadio = getRadio("dark");
    const lightRadio = getRadio("light");
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    expect(hasClassToken(autoRadio, "bg-tui-selection")).toBe(true);
    expect(autoRadio.getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hasClassToken(darkRadio, "bg-tui-selection")).toBe(true);
    expect(autoRadio.getAttribute("aria-checked")).toBe("true");
    expect(darkRadio.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hasClassToken(lightRadio, "bg-tui-selection")).toBe(true);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hasClassToken(cancelButton, "ring-tui-blue")).toBe(true);

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(hasClassToken(lightRadio, "bg-tui-selection")).toBe(true);
  });

  it("selects focused theme on Space without saving or exiting", () => {
    renderPage();

    const autoRadio = getRadio("auto");
    const darkRadio = getRadio("dark");
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: " " });

    expect(darkRadio.getAttribute("aria-checked")).toBe("true");
    expect(autoRadio.getAttribute("aria-checked")).toBe("false");
    expect(saveButton.getAttribute("disabled")).toBeNull();
    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("selects focused theme on Enter and saves + exits", () => {
    renderPage();

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("keeps preview scoped to the preview panel while focus changes", () => {
    renderPage();

    const preview = screen.getByTestId("theme-preview-root");

    expect(preview.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(preview.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(preview.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("updates preview on hover from focused list item even after entering button zone", () => {
    renderPage();

    const preview = screen.getByTestId("theme-preview-root");
    const darkRadio = getRadio("dark");
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hasClassToken(cancelButton, "ring-tui-blue")).toBe(true);

    fireEvent.mouseEnter(darkRadio);
    expect(preview.getAttribute("data-theme")).toBe("dark");
  });

  it("still selects theme by clicking list items", () => {
    renderPage();

    const darkRadio = getRadio("dark");
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    fireEvent.click(darkRadio);

    expect(darkRadio.getAttribute("aria-checked")).toBe("true");
    expect(saveButton.getAttribute("disabled")).toBeNull();
  });
});
