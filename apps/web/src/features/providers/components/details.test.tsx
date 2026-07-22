import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { KeyboardProvider } from "@diffgazer/keys";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useProvidersActionButtons } from "../hooks/use-action-buttons";
import { ProviderDetails } from "./details";

const NOOP_ACTIONS = {
  onSetApiKey: vi.fn(),
  onSelectModel: vi.fn(),
  onRemoveKey: vi.fn(),
  onSelectProvider: vi.fn(),
};

function makeProvider(overrides: Partial<ProviderWithStatus> = {}): ProviderWithStatus {
  const base: ProviderWithStatus = {
    id: "gemini",
    name: "Gemini",
    displayStatus: "configured",
    hasApiKey: false,
    isActive: false,
    model: undefined,
    defaultModel: "gemini-2.5-flash",
  };
  return { ...base, ...overrides };
}

function ActionNavigationSubject() {
  const [zone, setZone] = useState<"input" | "filters" | "list" | "buttons">("buttons");
  const provider = makeProvider({ hasApiKey: true, model: "gemini-2.5-flash" });
  const navigation = useProvidersActionButtons({
    selectedProvider: provider,
    dialogOpen: false,
    inButtons: zone === "buttons",
    setZone,
    focusProviderList: () => screen.getByRole("button", { name: "Outside actions" }).focus(),
    onSetApiKey: vi.fn(),
    onSelectModel: vi.fn(),
    onRemoveKey: vi.fn(async () => {}),
    onActivateProvider: vi.fn(),
  });

  return (
    <>
      <button type="button" onFocus={() => setZone("list")}>
        Outside actions
      </button>
      <ProviderDetails
        provider={provider}
        actions={NOOP_ACTIONS}
        isFocused={zone === "buttons"}
        focusedButtonIndex={navigation.buttonIndex}
        getButtonProps={navigation.getActionButtonProps}
      />
    </>
  );
}

describe("ProviderDetails (catalog)", () => {
  it("routes the primary button through the supplied activation action", async () => {
    const user = userEvent.setup();
    const onSelectProvider = vi.fn();
    render(
      <ProviderDetails
        provider={makeProvider({ hasApiKey: false })}
        actions={{
          ...NOOP_ACTIONS,
          onSelectProvider,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Select Provider" }));

    expect(onSelectProvider).toHaveBeenCalledOnce();
  });

  it("shows the default model placeholder when no model is selected", () => {
    render(<ProviderDetails provider={makeProvider()} actions={NOOP_ACTIONS} />);
    expect(screen.getByText(/gemini-2\.5-flash \(default\)/)).toBeInTheDocument();
  });

  it("shows the OpenRouter placeholder where the user always picks a model", () => {
    render(
      <ProviderDetails
        provider={makeProvider({ id: "openrouter", name: "OpenRouter", defaultModel: undefined })}
        actions={NOOP_ACTIONS}
      />,
    );
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getByText(/Model required/)).toBeInTheDocument();
  });

  it("degrades gracefully when an enabled provider has no default model", () => {
    render(
      <ProviderDetails
        provider={makeProvider({ id: "groq", name: "Groq", defaultModel: undefined })}
        actions={NOOP_ACTIONS}
      />,
    );
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getByText(/No default model/)).toBeInTheDocument();
  });

  it("prompts to select a provider when none is provided", () => {
    render(<ProviderDetails provider={null} actions={NOOP_ACTIONS} />);
    expect(screen.getByText(/select a provider to view details/i)).toBeInTheDocument();
  });

  it("disables every provider action while a mutation is pending", () => {
    render(
      <ProviderDetails
        provider={makeProvider({ hasApiKey: true, model: "gemini-2.5-flash" })}
        actions={NOOP_ACTIONS}
        isPending
      />,
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("prevents native scrolling only when vertical navigation moves between provider actions", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <ActionNavigationSubject />
      </KeyboardProvider>,
    );

    const firstAction = screen.getByRole("button", { name: "Select Provider" });
    const secondAction = screen.getByRole("button", { name: "Configure API Key" });
    await user.click(firstAction);

    const handled = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => firstAction.dispatchEvent(handled));

    expect(handled.defaultPrevented).toBe(true);
    await waitFor(() => expect(secondAction).toHaveFocus());

    const lastAction = screen.getByRole("button", { name: "Select Model" });
    await user.click(lastAction);
    const boundary = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => lastAction.dispatchEvent(boundary));

    expect(boundary.defaultPrevented).toBe(false);
    expect(lastAction).toHaveFocus();

    const outside = screen.getByRole("button", { name: "Outside actions" });
    await user.click(outside);
    const native = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    act(() => outside.dispatchEvent(native));

    expect(native.defaultPrevented).toBe(false);
    expect(outside).toHaveFocus();
  });
});
