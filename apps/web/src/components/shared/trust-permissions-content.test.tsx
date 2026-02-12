import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardProvider } from "keyscope";
import type { TrustCapabilities } from "@diffgazer/schemas/config";
import { TrustPermissionsContent } from "./trust-permissions-content";

function hasClassToken(element: Element, token: string): boolean {
  return element.className.split(/\s+/).includes(token);
}

function TrustPermissionsTestHarness() {
  const [value, setValue] = useState<TrustCapabilities>({
    readFiles: true,
    runCommands: false,
  });

  return (
    <KeyboardProvider>
      <TrustPermissionsContent
        directory="~/dev/projects/diffgazer-core"
        value={value}
        onChange={setValue}
        showActions
        onSave={() => {}}
        onRevoke={() => {}}
      />
    </KeyboardProvider>
  );
}

describe("TrustPermissionsContent", () => {
  it("initializes list focus and preserves it when switching between list and button zones", () => {
    render(<TrustPermissionsTestHarness />);

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    const saveButton = screen.getByRole("button", { name: /save changes/i });

    expect(hasClassToken(readFilesOption, "bg-tui-selection")).toBe(true);
    expect(readFilesOption.getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(window, { key: " " });
    expect(readFilesOption.getAttribute("aria-checked")).toBe("false");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(hasClassToken(saveButton, "ring-tui-blue")).toBe(true);
    expect(hasClassToken(readFilesOption, "bg-tui-selection")).toBe(false);

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(hasClassToken(saveButton, "ring-tui-blue")).toBe(false);
    expect(hasClassToken(readFilesOption, "bg-tui-selection")).toBe(true);
  });
});
