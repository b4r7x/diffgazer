import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/testing";
import type { ResolvedTheme, WebTheme } from "@/types/theme";

const mockNavigate = vi.fn();
const mockSetTheme = vi.fn();
let mockTheme: { theme: WebTheme; resolved: ResolvedTheme };

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// useTheme wraps ThemeProvider which depends on useSettings/useSaveSettings
// (API boundary), localStorage, window.matchMedia, and applies data-theme to
// document.documentElement — none of which work reliably in jsdom. Mocking at
// the hook boundary lets us control theme state without that infrastructure.
vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    ...mockTheme,
    setTheme: mockSetTheme,
  }),
}));

import { SettingsThemePage } from "./page";

function renderPage() {
  return renderWithProviders(<SettingsThemePage />);
}

describe("SettingsThemePage keyboard behavior", () => {
  beforeEach(() => {
    mockTheme = { theme: "auto", resolved: "light" };
    mockNavigate.mockReset();
    mockSetTheme.mockReset();
    document.documentElement.setAttribute("data-theme", "dark");
  });

  it("moves focus independently from selection and reaches button zone at list boundary", async () => {
    const user = userEvent.setup();
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const cancelButton = screen.getByRole("button", { name: /^cancel$/i });

    await waitFor(() => expect(autoRadio).toHaveFocus());
    expect(autoRadio).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowDown}");
    expect(autoRadio).toHaveAttribute("aria-checked", "true");
    expect(darkRadio).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(cancelButton).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("keeps focused radio arrow navigation separate from selection", async () => {
    const user = userEvent.setup();
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });

    autoRadio.focus();
    await user.keyboard("{ArrowDown}");

    expect(autoRadio).toHaveAttribute("aria-checked", "true");
    expect(darkRadio).toHaveAttribute("aria-checked", "false");

    darkRadio.focus();
    await user.keyboard(" ");

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
  });

  it("selects focused theme on Space without saving or exiting", async () => {
    const user = userEvent.setup();
    renderPage();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    await user.keyboard("{ArrowDown} ");

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(autoRadio).toHaveAttribute("aria-checked", "false");
    expect(saveButton).toBeEnabled();
    expect(mockSetTheme).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("selects focused theme on Enter and saves + exits", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(mockSetTheme).toHaveBeenCalledWith("light");
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("keeps preview scoped to the preview panel while focus changes", async () => {
    const user = userEvent.setup();
    renderPage();

    const preview = screen.getByTestId("theme-preview-root");

    expect(preview.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.keyboard("{ArrowDown}");
    expect(preview.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await user.keyboard("{ArrowDown}");
    expect(preview.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("updates preview on hover from focused list item even after entering button zone", async () => {
    const user = userEvent.setup();
    renderPage();

    const preview = screen.getByTestId("theme-preview-root");
    const darkRadio = screen.getByRole("radio", { name: /dark/i });

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    await user.hover(darkRadio);
    expect(preview.getAttribute("data-theme")).toBe("dark");
  });

  it("still selects theme by clicking list items", async () => {
    const user = userEvent.setup();
    renderPage();

    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    await user.click(darkRadio);

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(saveButton).toBeEnabled();
  });
});
