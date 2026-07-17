import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { StorageSelectorContent } from "./storage-selector-content";

function StorageSelectorHarness() {
  const [value, setValue] = useState<SecretsStorage | null>("file");
  return <StorageSelectorContent value={value} onChange={setValue} autoFocusList />;
}

describe("StorageSelectorContent", () => {
  it("moves highlight with arrows and selects with Space", async () => {
    const user = userEvent.setup();
    render(<StorageSelectorHarness />);

    expect(screen.getByRole("radiogroup", { name: /select storage method/i })).toBeInTheDocument();
    const fileRadio = screen.getByRole("radio", { name: /file storage/i });
    const keyringRadio = screen.getByRole("radio", { name: /system keyring/i });

    await waitFor(() => expect(fileRadio).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(fileRadio).toHaveAttribute("aria-checked", "true");
    expect(keyringRadio).toHaveAttribute("aria-checked", "false");

    await user.keyboard(" ");

    expect(screen.getByRole("radio", { name: /file storage/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("radio", { name: /system keyring/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("does not call onEnter when Space selects the highlighted storage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEnter = vi.fn();
    render(
      <StorageSelectorContent value="file" onChange={onChange} onEnter={onEnter} autoFocusList />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /file storage/i })).toHaveFocus());
    await user.keyboard("{ArrowDown} ");

    expect(onChange).toHaveBeenCalledWith("keyring");
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("commits the focused storage with Enter after a controlled value change", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const onChange = vi.fn((value: SecretsStorage) => calls.push(`change:${value}`));
    const onEnter = vi.fn((value: SecretsStorage) => calls.push(`enter:${value}`));
    const { rerender } = render(
      <StorageSelectorContent value={null} onChange={onChange} onEnter={onEnter} autoFocusList />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /file storage/i })).toHaveFocus());
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: /system keyring/i })).toHaveFocus();

    rerender(
      <StorageSelectorContent value="file" onChange={onChange} onEnter={onEnter} autoFocusList />,
    );
    await user.keyboard("{Enter}");

    expect(onEnter).toHaveBeenCalledWith("keyring");
    expect(onEnter).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("keyring");
    expect(onChange).toHaveBeenCalledOnce();
    expect(calls).toEqual(["change:keyring", "enter:keyring"]);
  });

  it("clears the highlighted storage when keyboard navigation is inactive", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <StorageSelectorContent value="file" onChange={onChange} autoFocusList />,
    );

    await waitFor(() => expect(screen.getByRole("radio", { name: /file storage/i })).toHaveFocus());
    await user.keyboard("{ArrowDown}");

    const keyringRadio = screen.getByRole("radio", { name: /system keyring/i });
    expect(keyringRadio).toHaveAttribute("data-highlighted");

    rerender(
      <StorageSelectorContent value="file" onChange={onChange} keyboardNavigation={false} />,
    );

    expect(keyringRadio).not.toHaveAttribute("data-highlighted");
  });
});
