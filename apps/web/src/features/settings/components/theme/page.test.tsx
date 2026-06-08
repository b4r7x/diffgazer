import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ThemeProvider } from "@/hooks/use-theme";

const mockNavigate = vi.fn();

// Boundary mock: Router is the routing library; tests provide a stub Router context so navigation assertions can be made without a real route tree.
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import { SettingsThemePage } from "./page";

const SETTINGS_FIXTURE: SettingsConfig = {
  theme: "auto",
  defaultLenses: [],
  defaultProfile: null,
  severityThreshold: "low",
  secretsStorage: null,
  agentExecution: "parallel",
};

let mockGetSettings: Mock<BoundApi["getSettings"]>;
let mockSaveSettings: Mock<BoundApi["saveSettings"]>;

function createTestApi(): BoundApi {
  return {
    ...createApi({ baseUrl: "http://localhost" }),
    getSettings: mockGetSettings,
    saveSettings: mockSaveSettings,
  } satisfies BoundApi;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const api = createTestApi();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider value={api}>
          <ThemeProvider>
            <FooterProvider>
              <KeyboardProvider>{children}</KeyboardProvider>
            </FooterProvider>
          </ThemeProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
  }

  return render(<SettingsThemePage />, { wrapper: Wrapper });
}

async function waitForThemeReady() {
  await waitFor(() => {
    expect(screen.getByRole("radio", { name: /auto/i })).toHaveAttribute("aria-checked", "true");
  });
}

describe("SettingsThemePage keyboard behavior", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    localStorage.clear();
    // Force light resolved theme via matchMedia stub for auto setting.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("moves focus independently from selection and reaches button zone at list boundary", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

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
    await waitForThemeReady();

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
    await waitForThemeReady();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    await user.keyboard("{ArrowDown} ");

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(autoRadio).toHaveAttribute("aria-checked", "false");
    expect(saveButton).toBeEnabled();
    expect(mockSaveSettings).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("selects focused theme on Enter and saves + exits", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(mockSaveSettings).toHaveBeenCalledWith({ theme: "light" });
    });
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("keeps preview scoped to the preview panel while focus changes", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    // Real ThemeProvider syncs documentElement to the resolved theme; pin it
    // here so we can prove the preview wrapper changes independently.
    document.documentElement.setAttribute("data-theme", "dark");

    const preview = screen.getByRole("region", { name: /theme preview/i });

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
    await waitForThemeReady();

    const preview = screen.getByRole("region", { name: /theme preview/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    await user.hover(darkRadio);
    expect(preview.getAttribute("data-theme")).toBe("dark");
  });

  it("still selects theme by clicking list items", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const saveButton = screen.getByRole("button", { name: /^save$/i });

    await user.click(darkRadio);

    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(saveButton).toBeEnabled();
  });
});
