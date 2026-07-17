import type { TrustCapabilities } from "@diffgazer/core/schemas/config";
import { createDeferred } from "@diffgazer/core/testing/deferred";
import { KeyboardProvider, useKey, useScope } from "@diffgazer/keys";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrustPermissionsContent } from "./trust-permissions-content";

const TEST_SCOPE = "trust-permissions-test";

interface TrustPermissionsTestHarnessProps {
  onSave?: () => void;
  onRevoke?: () => void;
  isLoading?: boolean;
}

function TrustPermissionsTestHarness({
  onSave = () => {},
  onRevoke = () => {},
  isLoading = false,
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
      isLoading={isLoading}
    />
  );
}

interface PassiveTestHarnessProps {
  onListBoundaryNext?: () => void;
  children?: ReactNode;
}

function PassiveTestHarness({ onListBoundaryNext, children }: PassiveTestHarnessProps) {
  const [value, setValue] = useState<TrustCapabilities>({
    readFiles: true,
    runCommands: false,
  });

  return (
    <>
      <TrustPermissionsContent
        directory="~/dev/projects/diffgazer-core"
        value={value}
        onChange={setValue}
        showActions={false}
        onListBoundaryNext={onListBoundaryNext}
        autoFocusList
      />
      {children}
    </>
  );
}

function getTrustPermissionsGroup() {
  return screen.getByRole("group", { name: /trust permissions/i });
}

function getReadFilesOption() {
  return within(getTrustPermissionsGroup()).getByRole("checkbox", {
    name: /repository access/i,
  });
}

describe("TrustPermissionsContent", () => {
  it("moves real keyboard focus between permissions and action buttons", async () => {
    const user = userEvent.setup();
    render(
      <KeyboardProvider>
        <TrustPermissionsTestHarness />
      </KeyboardProvider>,
    );

    const readFilesOption = getReadFilesOption();
    const saveButton = screen.getByRole("button", { name: /save changes/i });
    const revokeButton = screen.getByRole("button", { name: /revoke trust/i });

    await user.tab();
    expect(readFilesOption).toHaveFocus();
    expect(readFilesOption).toHaveAttribute("aria-checked", "true");

    await user.keyboard(" ");
    expect(readFilesOption).toHaveAttribute("aria-checked", "false");

    await user.keyboard("{Enter}");
    expect(readFilesOption).toHaveAttribute("aria-checked", "true");

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

    await user.click(screen.getByRole("button", { name: /outside action/i }));
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

    const readFilesOption = getReadFilesOption();
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

  it("freezes permissions and restores the initiating action after a deferred save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onRevoke = vi.fn();
    const onChange = vi.fn();
    const saveGate = createDeferred<void>();

    function Host() {
      const [value, setValue] = useState<TrustCapabilities>({
        readFiles: true,
        runCommands: false,
      });
      const [isLoading, setIsLoading] = useState(false);
      useScope(TEST_SCOPE);

      const handleSave = async () => {
        onSave(value);
        setIsLoading(true);
        await saveGate.promise;
        setIsLoading(false);
      };

      return (
        <TrustPermissionsContent
          directory="~/dev/projects/diffgazer-core"
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
          showActions
          keyboardScope={TEST_SCOPE}
          onSave={handleSave}
          onRevoke={onRevoke}
          isLoading={isLoading}
        />
      );
    }

    render(
      <KeyboardProvider>
        <Host />
      </KeyboardProvider>,
    );

    const readFilesOption = getReadFilesOption();
    await user.tab();
    await user.keyboard("{ArrowDown}{Enter}");

    const busyStatus = await screen.findByRole("status");
    expect(busyStatus).toHaveFocus();
    expect(getTrustPermissionsGroup()).toHaveAttribute("aria-disabled", "true");
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({ readFiles: true, runCommands: false });

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /revoking/i })).toBeDisabled();

    await user.click(readFilesOption);
    readFilesOption.focus();
    await user.keyboard("{Enter} ");

    expect(readFilesOption).toHaveAttribute("aria-checked", "true");
    expect(onChange).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onRevoke).not.toHaveBeenCalled();

    saveGate.resolve();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toHaveFocus(),
    );
  });

  it("calls onListBoundaryNext when arrowing past the last checkbox without actions", async () => {
    const user = userEvent.setup();
    const onBoundary = vi.fn();

    render(
      <KeyboardProvider>
        <PassiveTestHarness onListBoundaryNext={onBoundary} />
      </KeyboardProvider>,
    );

    const readFilesOption = getReadFilesOption();
    await user.click(readFilesOption);
    expect(readFilesOption).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(onBoundary).toHaveBeenCalledOnce();
  });

  it("clears checkbox highlight when focus leaves the list in passive mode", async () => {
    const user = userEvent.setup();
    const onBoundary = vi.fn();

    render(
      <KeyboardProvider>
        <PassiveTestHarness
          onListBoundaryNext={() => {
            onBoundary();
            screen.getByRole("button", { name: "Action" }).focus();
          }}
        >
          <button type="button">Action</button>
        </PassiveTestHarness>
      </KeyboardProvider>,
    );

    const readFilesOption = getReadFilesOption();
    expect(readFilesOption).toHaveFocus();
    expect(readFilesOption).toHaveAttribute("data-highlighted");

    await user.keyboard("{ArrowDown}");

    expect(onBoundary).toHaveBeenCalledOnce();
    const actionButton = screen.getByRole("button", { name: "Action" });
    expect(actionButton).toHaveFocus();
    expect(readFilesOption).not.toHaveAttribute("data-highlighted");
  });

  it("restores checkbox highlight when focus returns to the list in passive mode", async () => {
    const user = userEvent.setup();

    render(
      <KeyboardProvider>
        <PassiveTestHarness
          onListBoundaryNext={() => {
            screen.getByRole("button", { name: "Action" }).focus();
          }}
        >
          <button type="button">Action</button>
        </PassiveTestHarness>
      </KeyboardProvider>,
    );

    const readFilesOption = getReadFilesOption();
    expect(readFilesOption).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    const actionButton = screen.getByRole("button", { name: "Action" });
    expect(actionButton).toHaveFocus();
    expect(readFilesOption).not.toHaveAttribute("data-highlighted");

    await user.click(readFilesOption);
    expect(readFilesOption).toHaveFocus();
    expect(readFilesOption).toHaveAttribute("data-highlighted");
  });

  it("keeps surrounding shortcuts active when actions are hidden", async () => {
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
      </KeyboardProvider>,
    );

    await user.keyboard("s");

    expect(onShortcut).toHaveBeenCalledOnce();
  });
});
