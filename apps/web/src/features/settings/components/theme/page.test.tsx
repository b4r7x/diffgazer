import { type BoundApi, createApi } from "@diffgazer/core/api";
import { ApiProvider } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { stubMatchMedia } from "@diffgazer/core/testing/match-media";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ThemeProvider } from "@/hooks/use-theme";

const mockNavigate = vi.fn();

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

  return { ...render(<SettingsThemePage />, { wrapper: Wrapper }), queryClient };
}

async function waitForThemeReady() {
  await waitFor(() => {
    expect(screen.getByRole("radio", { name: /auto/i })).toHaveAttribute("aria-checked", "true");
  });
}

async function waitForSelectedTheme(name: RegExp) {
  await waitFor(() => {
    expect(screen.getByRole("radio", { name })).toHaveAttribute("aria-checked", "true");
  });
}

function setSystemPrefersDark(prefersDark: boolean): void {
  stubMatchMedia((query) => (query === "(prefers-color-scheme: dark)" ? prefersDark : false));
}

describe("SettingsThemePage keyboard behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockReset();
    mockGetSettings = vi.fn<BoundApi["getSettings"]>().mockResolvedValue(SETTINGS_FIXTURE);
    mockSaveSettings = vi.fn<BoundApi["saveSettings"]>().mockResolvedValue(undefined);
    setSystemPrefersDark(false);
    localStorage.clear();
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

  it("waits for the authoritative theme and keeps a dirty draft through background refetch", async () => {
    const settings = createDeferred<SettingsConfig>();
    mockGetSettings.mockReturnValueOnce(settings.promise);
    localStorage.setItem("diffgazer-theme", "dark");

    const { queryClient } = renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading settings");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    await act(async () => {
      settings.resolve({ ...SETTINGS_FIXTURE, theme: "light" });
    });
    await waitForSelectedTheme(/light/i);

    const user = userEvent.setup();
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    await user.click(darkRadio);
    expect(darkRadio).toHaveFocus();
    expect(darkRadio).toHaveAttribute("aria-checked", "true");

    mockGetSettings.mockResolvedValue({ ...SETTINGS_FIXTURE, theme: "auto" });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(mockGetSettings).toHaveBeenCalledTimes(2);
    expect(darkRadio).toHaveFocus();
    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /^save$/i })).toBeEnabled();
  });

  it("renders the settings-query error as an alert", async () => {
    mockGetSettings.mockRejectedValue(new Error("Settings unavailable"));

    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Settings unavailable");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("keeps radio focus and ArrowDown navigation after pointer re-entry from footer actions", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const darkRadio = screen.getByRole("radio", { name: /dark/i });
    const lightRadio = screen.getByRole("radio", { name: /light/i });
    await waitFor(() => expect(autoRadio).toHaveFocus());

    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("button", { name: /^cancel$/i })).toHaveFocus();

    await user.click(darkRadio);
    expect(darkRadio).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(lightRadio).toHaveFocus();
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

  it("previews the raw system theme for Auto when the saved theme is light", async () => {
    setSystemPrefersDark(true);
    mockGetSettings.mockResolvedValue({ ...SETTINGS_FIXTURE, theme: "light" });
    const user = userEvent.setup();
    renderPage();
    await waitForSelectedTheme(/light/i);

    const preview = screen.getByRole("region", { name: /theme preview/i });
    const autoRadio = screen.getByRole("radio", { name: /auto/i });
    const lightRadio = screen.getByRole("radio", { name: /light/i });

    expect(preview.getAttribute("data-theme")).toBe("light");

    await user.hover(autoRadio);
    expect(preview.getAttribute("data-theme")).toBe("dark");

    await user.unhover(autoRadio);
    await waitFor(() => expect(preview.getAttribute("data-theme")).toBe("light"));

    await waitFor(() => expect(lightRadio).toHaveFocus());
    await user.keyboard("{ArrowUp}{ArrowUp}");

    await waitFor(() => expect(autoRadio).toHaveFocus());
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

  it("keeps the failed-save error and dirty draft after the optimistic theme rolls back", async () => {
    mockSaveSettings.mockRejectedValue(new Error("Network unreachable"));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    await user.keyboard("{ArrowDown}{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Network unreachable");
    expect(screen.getByRole("radio", { name: /auto/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: /dark/i })).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("saves through the server when storage reads and writes are denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const user = userEvent.setup();

    renderPage();
    await waitForThemeReady();
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledWith({ theme: "dark" }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("mounts and saves when the storage object getter is denied", async () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const user = userEvent.setup();

    renderPage();
    await waitForThemeReady();
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledWith({ theme: "dark" }));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("ignores an overlapping theme save while one is still pending", async () => {
    let resolveSave: (() => void) | undefined;
    mockSaveSettings.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = () => resolve(undefined);
        }),
    );
    const user = userEvent.setup();
    renderPage();
    await waitForThemeReady();

    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(mockSaveSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeDisabled();

    // A save while one is in flight must be ignored, or a stale completion
    // could navigate or roll back over the newer state.
    await user.keyboard("{Enter}");
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);
    expect(mockSaveSettings).toHaveBeenCalledWith({ theme: "dark" });
    expect(mockNavigate).not.toHaveBeenCalled();

    resolveSave?.();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });
});
