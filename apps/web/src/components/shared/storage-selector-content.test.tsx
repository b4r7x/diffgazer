import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { StorageSelectorContent } from "./storage-selector-content";

function hasClassToken(element: Element, token: string): boolean {
  return element.className.split(/\s+/).includes(token);
}

function getRadio(value: SecretsStorage) {
  const radio = document.querySelector(`[role="radio"][data-value="${value}"]`);
  if (!radio) {
    throw new Error(`Missing radio with data-value="${value}"`);
  }
  return radio as HTMLElement;
}

function StorageSelectorHarness() {
  const [value, setValue] = useState<SecretsStorage | null>("file");
  return <StorageSelectorContent value={value} onChange={setValue} />;
}

describe("StorageSelectorContent", () => {
  it("moves highlight with arrows and selects with Space", () => {
    render(<StorageSelectorHarness />);

    const fileRadio = getRadio("file");
    const keyringRadio = getRadio("keyring");

    fireEvent.keyDown(fileRadio, { key: "ArrowDown" });

    expect(hasClassToken(keyringRadio, "bg-secondary")).toBe(true);
    expect(fileRadio.getAttribute("aria-checked")).toBe("true");
    expect(keyringRadio.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(keyringRadio, { key: " " });

    expect(getRadio("file").getAttribute("aria-checked")).toBe("false");
    expect(getRadio("keyring").getAttribute("aria-checked")).toBe("true");
  });
});
