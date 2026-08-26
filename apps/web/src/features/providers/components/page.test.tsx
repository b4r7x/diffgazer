import { type BoundApi, createApi } from "@diffgazer/core/api";
import { FooterProvider } from "@diffgazer/core/footer";
import { UNRECOGNIZED_CONFIGURATION_COPY } from "@diffgazer/core/providers";
import type { ConfigurationInitResponse } from "@diffgazer/core/schemas/config";
import {
  ClientConfigurationActionResponseSchema,
  LEGACY_V1_HAS_API_KEY_PROPERTY,
  PROVIDER_CONSENT_TEXT,
  type SettingsConfig,
} from "@diffgazer/core/schemas/config";
import {
  configurationStatus,
  GEMINI_CONFIGURATION,
  makeConfigurationInitResponse,
  makeConfigurationListResponse,
  OPENROUTER_CONFIGURATION,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalShortcuts } from "@/components/layout/global";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider } from "@/hooks/use-provider-consent";
import { clearScopedRouteState } from "@/hooks/use-scoped-route-state";
import { shutdown } from "@/lib/shutdown";
import { createConfigurationActionMocks } from "@/testing/configuration-action-mocks";
import { FooterView } from "@/testing/footer-view";
import { HeaderChromeHarness } from "@/testing/header-chrome";
import { ProvidersPage } from "./page";

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/providers-page-test" }),
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}));

vi.mock("@/lib/shutdown", () => ({
  shutdown: vi.fn().mockResolvedValue({ status: "closed" as const }),
  reportShutdownResult: vi.fn(),
}));

// No configuration is active, so the ready row keeps Select configuration as its primary.
function makeInitResponse(): ConfigurationInitResponse {
  return makeConfigurationInitResponse(
    [
      configurationStatus(GEMINI_CONFIGURATION, "ready"),
      configurationStatus(OPENROUTER_CONFIGURATION, "model-missing"),
    ],
    null,
  );
}

beforeAll(() => {
  if (typeof HTMLDialogElement === "undefined") return;
  HTMLDialogElement.prototype.showModal ??= function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close() {
    this.removeAttribute("open");
  };
});

let mockApi: ReturnType<typeof createMockApi>;

function createMockApi() {
  const api = createApi({ baseUrl: "http://localhost" });
  const init = makeInitResponse();
  const actionMocks = createConfigurationActionMocks();
  vi.mocked(actionMocks.createConfiguration).mockResolvedValue(
    ClientConfigurationActionResponseSchema.parse({
      action: "create",
      status: "succeeded",
      configuration: OPENROUTER_CONFIGURATION,
    }) as Awaited<ReturnType<BoundApi["createConfiguration"]>>,
  );
  return {
    ...api,
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    ...actionMocks,
  } satisfies BoundApi;
}

/**
 * A first run: no provider consent on record. Saving settings updates the init
 * the page refetches, the way the server does.
 */
function withoutProviderConsent() {
  const init = makeInitResponse();
  init.settings.providerConsent = null;
  mockApi.loadConfigurationInit.mockResolvedValue(init);
  mockApi.saveSettings = vi.fn(async (patch: Partial<SettingsConfig>) => {
    Object.assign(init.settings, patch);
  });
}

function getConsentDialog(): HTMLElement {
  return screen.getByRole("alertdialog", { name: "Provider data notice" });
}

// The layout attribute is the handle the responsive-contracts e2e already
// locates the panes by; data-state="focused" is Panel's documented bracket
// contract.
function getPane(container: HTMLElement, pane: "provider-list" | "provider-details"): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-layout-pane="${pane}"]`);
  if (!element) throw new Error(`Missing provider pane: ${pane}`);
  return element;
}

function renderProvidersPage({ footer = false, globalShortcuts = false, chrome = false } = {}) {
  const { Wrapper, queryClient } = createTestQueryWrapper({ api: mockApi });
  const page = (
    <>
      <ProvidersPage />
      {footer ? <FooterView /> : null}
    </>
  );
  const view = render(
    <Wrapper>
      <FooterProvider>
        <KeyboardProvider>
          {globalShortcuts ? <GlobalShortcuts /> : null}
          <ConfigProvider>
            <ProviderConsentProvider>
              {chrome ? <HeaderChromeHarness>{page}</HeaderChromeHarness> : page}
            </ProviderConsentProvider>
          </ConfigProvider>
        </KeyboardProvider>
      </FooterProvider>
    </Wrapper>,
  );
  return { ...view, queryClient };
}

function getDeleteConfirm(): HTMLElement {
  return screen.getByRole("alertdialog", { name: "Delete configuration?" });
}

describe("ProvidersPage", () => {
  beforeEach(() => {
    mockApi = createMockApi();
    clearScopedRouteState("/providers-page-test", "providerId");
    vi.clearAllMocks();
  });

  it("keeps the provider setup surface interactive behind an inline notice when init fails", async () => {
    mockApi.loadConfigurationInit.mockRejectedValue(new Error("init unavailable"));

    const { container } = renderProvidersPage();

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent("Configuration Unavailable");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // The catalog does not depend on the broken configuration: the recovery
    // screen keeps every product reachable so credentials can be re-entered.
    expect(screen.getByRole("listbox", { name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Google Gemini/ })).toBeInTheDocument();
    expect(screen.queryByText("Loading providers...")).not.toBeInTheDocument();
    // The notice sits directly above the panes container in the same page flow,
    // so on narrow viewports it scrolls away with the content instead of
    // pinning above the page's scroller.
    expect(notice.nextElementSibling).toContainElement(getPane(container, "provider-list"));
  });

  it("names the session mismatch in the inline notice when init is unauthorized", async () => {
    mockApi.loadConfigurationInit.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), { status: 401, code: "UNAUTHORIZED" }),
    );

    renderProvidersPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Session Not Authorized");
    expect(screen.getByRole("listbox", { name: "Providers" })).toBeInTheDocument();
  });

  it("shows no configuration notice when init succeeds", async () => {
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gates Select configuration behind the provider consent and continues once it is accepted", async () => {
    const user = userEvent.setup();
    withoutProviderConsent();
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    expect(screen.queryByText(PROVIDER_CONSENT_TEXT)).not.toBeInTheDocument();
    const select = screen.getByRole("button", { name: "Select configuration" });
    await user.click(select);

    const dialog = getConsentDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByText(PROVIDER_CONSENT_TEXT)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Privacy notes/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/app/concepts/privacy"),
    );
    // Initial focus lands on the confirming action, so Enter accepts.
    const accept = within(dialog).getByRole("button", { name: "Accept and continue" });
    await waitFor(() => expect(accept).toHaveFocus());
    expect(mockApi.selectConfiguration).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(mockApi.saveSettings).toHaveBeenCalledWith({
        providerConsent: { version: 1, acceptedAt: expect.any(String) },
      }),
    );
    await waitFor(() => expect(mockApi.selectConfiguration).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog", { name: "Provider data notice" })).toBeNull(),
    );
    expect(mockApi.saveSettings).toHaveBeenCalledOnce();

    // Accepted once: the next gated action runs without asking again.
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Verify" }));
    await waitFor(() => expect(mockApi.testConfiguration).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("gates Verify and Update configuration too, and Not now cancels the action", async () => {
    const user = userEvent.setup();
    withoutProviderConsent();
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Verify" }));
    await user.click(within(getConsentDialog()).getByRole("button", { name: "Not now" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockApi.testConfiguration).not.toHaveBeenCalled();
    expect(mockApi.saveSettings).not.toHaveBeenCalled();

    // Setup is gated as well: the credentials dialog waits behind the notice.
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Update configuration" }));
    expect(screen.queryByRole("dialog", { name: /Update Configuration/ })).not.toBeInTheDocument();
    await user.click(
      within(getConsentDialog()).getByRole("button", { name: "Accept and continue" }),
    );
    expect(await screen.findByRole("dialog", { name: /Update Configuration/ })).toBeInTheDocument();
  });

  it("keeps a way back to the declined notice in the details pane and restores focus on Escape", async () => {
    const user = userEvent.setup();
    withoutProviderConsent();
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    const details = screen.getByRole("region", { name: "Provider details" });
    // Neutral status, not an alert: the app stays usable without the consent.
    expect(within(details).getByText("Consent required to run reviews")).toBeInTheDocument();
    expect(within(details).queryByRole("alert")).not.toBeInTheDocument();
    const review = within(details).getByRole("button", {
      name: "Review the provider data notice",
    });
    await user.click(review);

    const dialog = getConsentDialog();
    // Opened on its own there is nothing to continue, so the button just accepts.
    expect(within(dialog).getByRole("button", { name: "Accept" })).toBeInTheDocument();
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(dialog, new Event("cancel", { bubbles: false }));
    // fireEvent retained: animationend has no user-event equivalent; the libs/ui dialog
    // completes its close presence transition — and restores focus — on this event.
    fireEvent.animationEnd(dialog);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(review).toHaveFocus());
    expect(mockApi.saveSettings).not.toHaveBeenCalled();

    // The key the pane teaches beside the status reopens it as well.
    await user.keyboard("c");
    expect(getConsentDialog()).toBeInTheDocument();
  });

  it("opens the model picker from a model-missing primary without asking for consent", async () => {
    const user = userEvent.setup();
    const init = makeConfigurationInitResponse(
      [configurationStatus(OPENROUTER_CONFIGURATION, "model-missing")],
      null,
    );
    init.settings.providerConsent = null;
    mockApi.loadConfigurationInit.mockResolvedValue(init);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(init));
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    await user.click(screen.getByRole("option", { name: /OpenRouter/i }));
    await user.click(await screen.findByRole("button", { name: "Select model" }));

    expect(await screen.findByRole("dialog", { name: "Select Model" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("runs the gated actions straight away once provider consent is on record", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    await screen.findByRole("listbox", { name: "Providers" });
    expect(screen.queryByText("Consent required to run reviews")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select configuration" }));

    await waitFor(() => expect(mockApi.selectConfiguration).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("preserves keyboard flow into enabled actions", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
  });

  it("keeps Left and Right inside the open More menu instead of stepping the action row", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    // Reach More from the row so its virtual focus, not a click, sits on the trigger.
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("data-highlighted");

    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu", { name: "More actions" });
    await waitFor(() => expect(menu).toHaveFocus());
    expect(trigger).not.toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowLeft}");
    expect(menu).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(menu).toHaveFocus();
    expect(screen.getByRole("button", { name: /Change model/i })).not.toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("data-highlighted");
  });

  it("shows the active configuration as a chip beside Change model and More", async () => {
    const init = makeConfigurationInitResponse(
      [configurationStatus(GEMINI_CONFIGURATION, "ready")],
      GEMINI_CONFIGURATION.configurationId,
    );
    mockApi.loadConfigurationInit.mockResolvedValue(init);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(init));
    renderProvidersPage();

    const actions = await screen.findByRole("group", { name: "Provider actions" });
    expect(within(actions).getByText("Active")).toBeInTheDocument();
    expect(
      within(actions)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Change model", "More actions"]);
  });

  it("asks before deleting on d: a held key stops at Cancel, Escape keeps the configuration", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("d");

    const confirm = getDeleteConfirm();
    expect(confirm).toHaveAttribute("aria-modal", "true");
    expect(within(confirm).getByText(/Removes Google Gemini/)).toBeInTheDocument();
    const cancel = within(confirm).getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveFocus());

    // The key that opened it, repeated or held, and Enter on the safe action delete nothing.
    await user.keyboard("dd{Enter}");
    expect(mockApi.deleteConfiguration).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.keyboard("d");
    const reopened = getDeleteConfirm();
    await waitFor(() =>
      expect(within(reopened).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    // fireEvent retained: dialog cancel is a native Event; userEvent has no cancel dispatch.
    fireEvent(reopened, new Event("cancel", { bubbles: false }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockApi.deleteConfiguration).not.toHaveBeenCalled();
    await waitFor(() => expect(listbox).toHaveFocus());
  });

  it("deletes once the confirmation's Delete is chosen, from the More menu's own d", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const menu = await screen.findByRole("menu", { name: "More actions" });
    await waitFor(() => expect(menu).toHaveFocus());

    await user.keyboard("d");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    const confirm = getDeleteConfirm();
    expect(mockApi.deleteConfiguration).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(mockApi.deleteConfiguration).toHaveBeenCalledWith("gemini-primary", 1),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("stands the global shortcuts down while the More menu and the confirmations own the keys", async () => {
    const user = userEvent.setup();
    withoutProviderConsent();
    renderProvidersPage({ globalShortcuts: true });

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await waitFor(() => expect(screen.getByRole("menu", { name: "More actions" })).toHaveFocus());
    await user.keyboard("h");
    expect(navigateMock).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());

    await user.keyboard("d");
    const deleteConfirm = getDeleteConfirm();
    await waitFor(() =>
      expect(within(deleteConfirm).getByRole("button", { name: "Cancel" })).toHaveFocus(),
    );
    await user.keyboard("s");
    expect(navigateMock).not.toHaveBeenCalled();
    await user.click(within(deleteConfirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    await user.keyboard("v");
    const notice = getConsentDialog();
    await waitFor(() =>
      expect(within(notice).getByRole("button", { name: "Accept and continue" })).toHaveFocus(),
    );
    await user.keyboard("s");
    expect(navigateMock).not.toHaveBeenCalled();
    await user.click(within(notice).getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    // The same key navigates once nothing owns the keys, proving the shortcuts were live.
    await user.keyboard("h");
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/history" }));
  });

  it("lands on the More trigger when Tab closes the open menu", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole("menu", { name: "More actions" })).toHaveFocus());

    await user.tab();

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(listbox).not.toHaveFocus();
  });

  it("parks the page zone on the chrome so the footer drops the search-zone hints", async () => {
    const user = userEvent.setup();
    renderProvidersPage({ footer: true, chrome: true });

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    const search = screen.getByRole("searchbox", { name: "Search providers" });
    await user.click(search);
    const footer = screen.getByRole("contentinfo");
    await waitFor(() => expect(footer).toHaveTextContent("Clear / Exit Search"));

    await user.keyboard("{ArrowUp}");

    const back = screen.getByRole("button", { name: "Back" });
    await waitFor(() => expect(back).toHaveFocus());
    expect(footer).not.toHaveTextContent("Clear / Exit Search");
    expect(footer).toHaveTextContent("Back");
  });

  it("hands the footer to the More menu while it is open", async () => {
    const user = userEvent.setup();
    renderProvidersPage({ footer: true });

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    const footer = screen.getByRole("contentinfo");
    await waitFor(() => expect(footer).toHaveTextContent("Verify"));
    expect(footer).toHaveTextContent("Select configuration");

    await user.click(screen.getByRole("button", { name: "More actions" }));
    await screen.findByRole("menu", { name: "More actions" });

    expect(footer).toHaveTextContent("Navigate");
    expect(footer).toHaveTextContent("Run");
    expect(footer).toHaveTextContent("Close");
    expect(footer).not.toHaveTextContent("Verify");
    expect(footer).not.toHaveTextContent("Select configuration");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(footer).toHaveTextContent("Verify");
  });

  // Typeahead claims a printable key only when it matches a row, so the keys
  // the page and the shell advertise stay live on every miss.
  it("opens the search box from / while the list holds focus", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    await user.keyboard("/");

    await waitFor(() =>
      expect(screen.getByRole("searchbox", { name: "Search providers" })).toHaveFocus(),
    );
  });

  // The APG-correct other half: a letter that does match a row belongs to the
  // list while it has focus and never reaches the shell's own bindings.
  it("keeps a matched typeahead letter on the list instead of reaching the shell", async () => {
    const user = userEvent.setup();
    renderProvidersPage({ globalShortcuts: true });

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    await user.keyboard("z");

    expect(screen.getByRole("option", { name: "Z.AI" })).toHaveAttribute("aria-selected", "true");
    expect(shutdown).not.toHaveBeenCalled();

    // Control: the same key quits once the list no longer owns the keys, so the
    // assertion above is a claim and not a dead binding.
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(listbox).not.toHaveFocus());
    await user.keyboard("q");

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("keeps a bound letter the state cannot run from moving the list", async () => {
    // An unconfigured provider has nothing to delete, so `d` runs nothing there;
    // it must not fall through to typeahead and move the selection either.
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    const ollamaCloud = screen.getByRole("option", { name: "Ollama Cloud" });
    await user.click(ollamaCloud);
    expect(ollamaCloud).toHaveAttribute("aria-selected", "true");

    await user.keyboard("d");

    expect(ollamaCloud).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("runs Verify from its accelerator while the list has focus", async () => {
    const user = userEvent.setup();
    renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("v");

    await waitFor(() => expect(mockApi.testConfiguration).toHaveBeenCalledWith("gemini-primary"));
  });

  it("moves the focus brackets between the list and details panes", async () => {
    const user = userEvent.setup();
    const { container } = renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    expect(getPane(container, "provider-list")).toHaveAttribute("data-state", "focused");
    expect(getPane(container, "provider-details")).not.toHaveAttribute("data-state");

    await user.click(screen.getByRole("option", { name: "Google Gemini" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus();
    expect(getPane(container, "provider-details")).toHaveAttribute("data-state", "focused");
    expect(getPane(container, "provider-list")).not.toHaveAttribute("data-state");
  });

  it("cycles Tab through the scrollable details pane between the list and the actions", async () => {
    const user = userEvent.setup();
    renderProvidersPage({ footer: true });

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());
    await user.click(screen.getByRole("option", { name: "Google Gemini" }));

    const pane = screen.getByRole("region", { name: "Provider details content" });
    await user.tab();
    await waitFor(() => expect(pane).toHaveFocus());
    // The pane zone teaches its own keys while the scroll region holds focus.
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Scroll");

    await user.tab();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Select configuration/i })).toHaveFocus(),
    );

    // Shift+Tab must return onto the pane even though the action row nests inside it.
    await user.tab({ shift: true });
    await waitFor(() => expect(pane).toHaveFocus());

    await user.tab({ shift: true });
    await waitFor(() => expect(listbox).toHaveFocus());
  });

  it("rests both panes once focus leaves them", async () => {
    const user = userEvent.setup();
    const { container } = renderProvidersPage();

    const listbox = await screen.findByRole("listbox", { name: "Providers" });
    await waitFor(() => expect(listbox).toHaveFocus());

    await user.click(document.body);

    expect(listbox).not.toHaveFocus();
    expect(getPane(container, "provider-list")).not.toHaveAttribute("data-state");
    expect(getPane(container, "provider-details")).not.toHaveAttribute("data-state");
  });

  // Retiring a product turns its stored record into bytes this build cannot
  // decode. The row exists so that record does not become permanent: it names
  // itself honestly, offers removal and nothing else, and the delete asserts no
  // revision because the list never showed one.
  it("offers only removal for a stored record this build could not decode", async () => {
    const user = userEvent.setup();
    const init = makeConfigurationInitResponse(
      [configurationStatus(GEMINI_CONFIGURATION, "ready")],
      GEMINI_CONFIGURATION.configurationId,
      [{ configurationId: "cfg-retired" }],
    );
    mockApi.loadConfigurationInit.mockResolvedValue(init);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(init));

    renderProvidersPage();

    await user.click(
      await screen.findByRole("option", { name: UNRECOGNIZED_CONFIGURATION_COPY.label }),
    );

    // Both surfaces render the copy core owns, so neither can describe the same
    // record differently.
    expect(screen.getByText(UNRECOGNIZED_CONFIGURATION_COPY.description)).toBeInTheDocument();
    const actions = screen.getByRole("group", { name: "Provider actions" });
    const buttons = within(actions).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("More actions");

    await user.click(within(actions).getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete configuration" }));

    // A successful delete invalidates the config caches, so the refetched list
    // no longer carries the record and its row leaves the listbox.
    const afterDelete = makeConfigurationInitResponse(
      [configurationStatus(GEMINI_CONFIGURATION, "ready")],
      GEMINI_CONFIGURATION.configurationId,
    );
    mockApi.loadConfigurationInit.mockResolvedValue(afterDelete);
    mockApi.listConfigurations.mockResolvedValue(makeConfigurationListResponse(afterDelete));
    await user.click(within(getDeleteConfirm()).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(mockApi.deleteConfiguration).toHaveBeenCalledWith("cfg-retired", undefined),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: UNRECOGNIZED_CONFIGURATION_COPY.label }),
      ).not.toBeInTheDocument(),
    );
  });

  it("renders no secret-bearing JSON in the page tree", async () => {
    const { container } = renderProvidersPage();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Google Gemini" })).toBeInTheDocument(),
    );

    const serialized = container.innerHTML;
    expect(serialized).not.toContain(LEGACY_V1_HAS_API_KEY_PROPERTY);
    expect(serialized).not.toContain("providerStatus");
    expect(serialized).not.toContain("sk-");
    expect(serialized).not.toMatch(/"secret"\s*:/);
  });
});
