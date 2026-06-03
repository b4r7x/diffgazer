import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProviderWithStatus } from "@diffgazer/core/schemas/config";
import { ProviderDetails } from "./provider-details";

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

describe("ProviderDetails (catalog)", () => {
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
});
