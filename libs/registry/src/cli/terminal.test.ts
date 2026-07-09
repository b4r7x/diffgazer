import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Boundary mock: third-party interactive prompt library. The non-interactive
// guard must fire before these are ever called.
vi.mock("@clack/prompts", () => ({
  confirm: vi.fn().mockResolvedValue(true),
  select: vi.fn().mockResolvedValue("copy"),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}));

import * as clack from "@clack/prompts";
import { promptConfirm, promptSelect, setSilent } from "./terminal.js";

const selectOptions = [
  { value: "copy", label: "Copy hooks" },
  { value: "keys", label: "Keys package" },
];

describe("terminal prompt non-interactive boundary", () => {
  const originalStdin = process.stdin.isTTY;
  const originalStdout = process.stdout.isTTY;

  function setTty(value: boolean): void {
    process.stdin.isTTY = value;
    process.stdout.isTTY = value;
  }

  beforeEach(() => {
    setSilent(false);
    setTty(true);
    vi.mocked(clack.confirm).mockClear();
    vi.mocked(clack.select).mockClear();
  });

  afterEach(() => {
    setSilent(false);
    process.stdin.isTTY = originalStdin;
    process.stdout.isTTY = originalStdout;
  });

  it("fails with --yes guidance when confirmation is required without a TTY", async () => {
    setTty(false);

    await expect(promptConfirm("Continue with initialization?")).rejects.toThrow(/--yes/);
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("surfaces caller-supplied flag guidance when a choice is required without a TTY", async () => {
    setTty(false);

    await expect(
      promptSelect(
        "Choose keyboard integration mode:",
        selectOptions,
        "Pass --integration=copy|keys|none.",
      ),
    ).rejects.toThrow(/--integration=copy\|keys\|none/);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("uses generic non-interactive guidance when no caller flag guidance is given", async () => {
    setTty(false);

    const err = await promptSelect("What would you like to do?", selectOptions).catch(
      (e: unknown) => e,
    );
    if (!(err instanceof Error)) throw new Error("expected promptSelect to reject");
    expect(err.message).toMatch(/non-interactive/);
    expect(err.message).not.toMatch(/--integration/);
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("does not auto-answer confirmation prompts under --silent", async () => {
    setSilent(true);

    await expect(promptConfirm("Continue with initialization?", true)).rejects.toThrow(/--yes/);
    expect(clack.confirm).not.toHaveBeenCalled();
  });

  it("does not auto-select the first option under --silent", async () => {
    setSilent(true);

    await expect(promptSelect("Choose keyboard integration mode:", selectOptions)).rejects.toThrow(
      /non-interactive/,
    );
    expect(clack.select).not.toHaveBeenCalled();
  });

  it("prompts through clack when interactive and not silent", async () => {
    const confirmed = await promptConfirm("Continue with initialization?");
    const selected = await promptSelect("Choose keyboard integration mode:", selectOptions);

    expect(confirmed).toBe(true);
    expect(selected).toBe("copy");
    expect(clack.confirm).toHaveBeenCalledOnce();
    expect(clack.select).toHaveBeenCalledOnce();
  });
});
