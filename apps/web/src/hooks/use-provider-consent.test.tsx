import { type BoundApi, createApi } from "@diffgazer/core/api";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import {
  makeConfigurationListResponse,
  makeReadyInitResponse,
} from "@diffgazer/core/testing/provider-fixtures";
import { createTestQueryWrapper } from "@diffgazer/core/testing/query-wrapper";
import { KeyboardProvider } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfigProvider } from "@/hooks/use-config";
import { ProviderConsentProvider, useProviderConsent } from "@/hooks/use-provider-consent";

function GatedAction({ onRun }: { onRun: () => void }) {
  const consent = useProviderConsent();
  return (
    <>
      <output>{consent.consent ? "accepted" : "required"}</output>
      <button type="button" onClick={() => consent.require(onRun)}>
        Verify
      </button>
      <button type="button" onClick={consent.open}>
        Notice
      </button>
    </>
  );
}

function renderGate({
  recorded,
  saveSettings,
}: {
  recorded: boolean;
  saveSettings?: () => Promise<void>;
}) {
  const init = makeReadyInitResponse();
  if (!recorded) init.settings.providerConsent = null;
  const api = {
    ...createApi({ baseUrl: "http://localhost" }),
    loadConfigurationInit: vi.fn().mockResolvedValue(init),
    listConfigurations: vi.fn().mockResolvedValue(makeConfigurationListResponse(init)),
    saveSettings: vi.fn(
      saveSettings ??
        (async (patch: Partial<SettingsConfig>) => {
          Object.assign(init.settings, patch);
        }),
    ),
  } satisfies BoundApi;
  const { Wrapper } = createTestQueryWrapper({ api });
  const onRun = vi.fn();
  render(
    <Wrapper>
      <KeyboardProvider>
        <ConfigProvider>
          <ProviderConsentProvider>
            <GatedAction onRun={onRun} />
          </ProviderConsentProvider>
        </ConfigProvider>
      </KeyboardProvider>
    </Wrapper>,
  );
  return { api, onRun };
}

describe("useProviderConsent", () => {
  it("holds the action behind the notice, records the acceptance and then runs it", async () => {
    const user = userEvent.setup();
    const { api, onRun } = renderGate({ recorded: false });

    await screen.findByText("required");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    const dialog = screen.getByRole("alertdialog", { name: "Provider data notice" });
    expect(onRun).not.toHaveBeenCalled();
    // jsdom computes no animation, which would unmount the dialog the instant it
    // closes; give it the exit animation it has in the browser so it stays up
    // (until the presence fallback) while the settings refetch lands.
    const getComputedStyle = window.getComputedStyle;
    const computedStyle = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) =>
        element === dialog
          ? ({ animationName: "dialog-out" } as CSSStyleDeclaration)
          : getComputedStyle(element),
      );

    await user.click(within(dialog).getByRole("button", { name: "Accept and continue" }));

    await waitFor(() => expect(onRun).toHaveBeenCalledOnce());
    expect(api.saveSettings).toHaveBeenCalledWith({
      providerConsent: { version: 1, acceptedAt: expect.any(String) },
    });
    // The recorded consent is read back from the refetched settings...
    await screen.findByText("accepted");
    // ...while the closing dialog keeps the notice it was accepted with.
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription("Asked once, before anything is sent to a provider");
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    computedStyle.mockRestore();
  });

  it("keeps the notice open and reports when the acceptance cannot be saved", async () => {
    const user = userEvent.setup();
    const { onRun } = renderGate({
      recorded: false,
      saveSettings: async () => {
        throw new Error("settings file is read-only");
      },
    });

    await screen.findByText("required");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    const dialog = screen.getByRole("alertdialog", { name: "Provider data notice" });
    await user.click(within(dialog).getByRole("button", { name: "Accept and continue" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "settings file is read-only",
    );
    expect(dialog).toBeInTheDocument();
    expect(onRun).not.toHaveBeenCalled();
  });

  it("reads the recorded notice back on its own once accepted", async () => {
    const user = userEvent.setup();
    const { api } = renderGate({ recorded: true });

    await screen.findByText("accepted");
    await user.click(screen.getByRole("button", { name: "Notice" }));
    const dialog = screen.getByRole("alertdialog", { name: "Provider data notice" });

    expect(dialog).toHaveAccessibleDescription(/^Accepted /);
    expect(within(dialog).queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
    // The browser fades the closed dialog out; it keeps the read-back it showed meanwhile.
    const getComputedStyle = window.getComputedStyle;
    const computedStyle = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation((element) =>
        element === dialog
          ? ({ animationName: "dialog-out" } as CSSStyleDeclaration)
          : getComputedStyle(element),
      );
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAccessibleDescription(/^Accepted /);
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Accept/ })).not.toBeInTheDocument();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    computedStyle.mockRestore();
    expect(api.saveSettings).not.toHaveBeenCalled();
  });
});
