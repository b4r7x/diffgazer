import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardProvider, useKey, useScope } from "@diffgazer/keys";
import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { TrustPermissionsContent } from "./trust-permissions-content";

const TEST_SCOPE = "trust-permissions-test";

interface TrustPermissionsTestHarnessProps {
  onSave?: () => void;
  onRevoke?: () => void;
}

function TrustPermissionsTestHarness({
  onSave = () => {},
  onRevoke = () => {},
}: TrustPermissionsTestHarnessProps) {
  const [value, setValue] = useState<TrustCapabilities>({
    readFiles: true,
    runCommands: false,
  });

  useScope(TEST_SCOPE);

  return (
    <TrustPermissionsContent
      directory="~/dev/projects/diffgazer-core"
      value={value}
      onChange={setValue}
      showActions
      keyboardScope={TEST_SCOPE}
      onSave={onSave}
      onRevoke={onRevoke}
    />
  );
}

describe("TrustPermissionsContent", () => {
  it("moves real keyboard focus between permissions and action buttons", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <TrustPermissionsTestHarness />
      </KeyboardProvider>,
    );

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    const revokeButton = screen.getByRole("button", { name: /revoke trust/i });

    await user.tab();
    expect(readFilesOption).toHaveFocus();
    expect(readFilesOption.getAttribute("aria-checked")).toBe("true");

    await user.keyboard(" ");
    expect(readFilesOption.getAttribute("aria-checked")).toBe("false");

    await user.keyboard("{ArrowDown}");
    expect(saveButton).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(revokeButton).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(readFilesOption).toHaveFocus();
  });

  it("activates the focused action once with Enter and Space", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onRevoke = vi.fn();

    render(
      <KeyboardProvider>
        <TrustPermissionsTestHarness onSave={onSave} onRevoke={onRevoke} />
      </KeyboardProvider>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onSave).toHaveBeenCalledOnce();
    expect(onRevoke).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    await user.keyboard(" ");

    expect(onSave).toHaveBeenCalledOnce();
    expect(onRevoke).toHaveBeenCalledOnce();
  });

  it("does not activate action shortcuts when focus is outside the action row", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    function Host() {
      return (
        <>
          <TrustPermissionsTestHarness onSave={onSave} />
          <button type="button">Outside action</button>
        </>
      );
    }

    render(
      <KeyboardProvider>
        <Host />
      </KeyboardProvider>,
    );

    await user.tab();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /save changes/i })).toHaveFocus();

    screen.getByRole("button", { name: /outside action/i }).focus();
    await user.keyboard("{Enter}");

    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps arrow-key action navigation active after tabbing into the action row", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <TrustPermissionsTestHarness />
      </KeyboardProvider>,
    );

    const readFilesOption = screen.getByRole("checkbox", { name: /repository access/i });
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    const revokeButton = screen.getByRole("button", { name: /revoke trust/i });

    await user.tab();
    expect(readFilesOption).toHaveFocus();

    await user.tab();
    expect(saveButton).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(revokeButton).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(readFilesOption).toHaveFocus();
  });

  it("does not install a private shortcut scope when rendered without actions", async () => {
    const user = userEvent.setup();
    const onShortcut = vi.fn();

    function Host() {
      const [value, setValue] = useState<TrustCapabilities>({
        readFiles: true,
        runCommands: false,
      });

      useScope("host");
      useKey("s", onShortcut);

      return (
        <TrustPermissionsContent
          directory="~/dev/projects/diffgazer-core"
          value={value}
          onChange={setValue}
          showActions={false}
        />
      );
    }

    render(
      <KeyboardProvider>
        <Host />
      </KeyboardProvider>
    );

    await user.keyboard("s");

    expect(onShortcut).toHaveBeenCalledOnce();
  });
});
