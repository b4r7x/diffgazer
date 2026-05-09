import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider } from "@diffgazer/keys";
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

function renderPage() {
  return render(
    <KeyboardProvider>
      <SettingsThemePage />
    </KeyboardProvider>
  );
}

describe("SettingsThemePage keyboard behavior", () => {
  beforeEach(() => {
    mockTheme = { theme: "auto", resolved: "light" };
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
    document.documentElement.setAttribute("data-theme", "dark");
  });

  it("moves focus independently from selection and reaches button zone at list boundary", async () => {
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const cancelButton = screen.getByRole("button", { name: /^cancel$/i });

    await waitFor(() => expect(autoRadio).toHaveFocus());
    expect(autoRadio.getAttribute("aria-checked")).toBe("true");

    await userEvent.keyboard("{ArrowDown}");
    expect(autoRadio.getAttribute("aria-checked")).toBe("true");
    expect(darkRadio.getAttribute("aria-checked")).toBe("false");

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(cancelButton).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("keeps focused radio arrow navigation separate from selection", () => {
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });

    fireEvent.keyDown(autoRadio, { key: "ArrowDown" });

    expect(autoRadio.getAttribute("aria-checked")).toBe("true");
    expect(darkRadio.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(darkRadio, { key: " " });

    expect(darkRadio.getAttribute("aria-checked")).toBe("true");
  });

  it("selects focused theme on Space without saving or exiting", () => {
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
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
    const darkRadio = screen.getByRole("radio", { name: /dark/i });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });

    fireEvent.mouseEnter(darkRadio);
    expect(preview.getAttribute("data-theme")).toBe("dark");
  });

  it("still selects theme by clicking list items", () => {
    renderPage();

    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    fireEvent.click(darkRadio);

    expect(darkRadio.getAttribute("aria-checked")).toBe("true");
    expect(saveButton.getAttribute("disabled")).toBeNull();
  });
});
