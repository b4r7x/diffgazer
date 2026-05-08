import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";
import type { AIProvider } from "@diffgazer/core/schemas/config";
import { ProviderStep } from "./provider-step";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("ProviderStep", () => {
  it("commits the current selected provider when Enter is pressed", async () => {
    const selectedProvider = AVAILABLE_PROVIDERS.find((provider) => provider.id === "openrouter");
    if (!selectedProvider) throw new Error("ProviderStep test needs the OpenRouter provider");

    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <ProviderStep
        value={selectedProvider.id as AIProvider}
        onChange={vi.fn()}
        onCommit={onCommit}
      />,
    );

    screen.getByRole("radio", { name: new RegExp(escapeRegExp(selectedProvider.name)) }).focus();
    await user.keyboard("{Enter}");

    expect(onCommit).toHaveBeenCalledWith(selectedProvider.id);
  });
});
