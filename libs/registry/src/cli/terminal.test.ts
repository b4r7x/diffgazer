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
import {
  CancelError,
  error,
  info,
  promptConfirm,
  promptSelect,
  setSilent,
  toErrorMessage,
} from "./terminal.js";

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

  it("sends the exact confirm request to clack, including a non-default initial value", async () => {
    await promptConfirm("Remove 3 file(s)?", false);

    expect(clack.confirm).toHaveBeenCalledWith({
      message: "Remove 3 file(s)?",
      initialValue: false,
    });
  });

  it("throws CancelError when the user cancels a confirmation prompt", async () => {
    vi.mocked(clack.isCancel).mockReturnValueOnce(true);

    await expect(promptConfirm("Continue with initialization?")).rejects.toBeInstanceOf(
      CancelError,
    );
  });

  it("throws CancelError when the user cancels a selection prompt", async () => {
    vi.mocked(clack.isCancel).mockReturnValueOnce(true);

    await expect(
      promptSelect("Choose keyboard integration mode:", selectOptions),
    ).rejects.toBeInstanceOf(CancelError);
  });
});

describe("toErrorMessage", () => {
  it("renders AggregateError.errors at the CLI boundary", () => {
    const error = new AggregateError(
      [new Error("manifest write failed"), new Error("failed to restore copied hooks")],
      "Add finalization failed and rollback was incomplete.",
    );

    expect(toErrorMessage(error)).toBe(
      [
        "Add finalization failed and rollback was incomplete.",
        "  - manifest write failed",
        "  - failed to restore copied hooks",
      ].join("\n"),
    );
  });

  it("renders AggregateError causes attached to the primary failure", () => {
    const rollback = new AggregateError(
      [new Error("failed to restore src/styles/styles.css")],
      "Initialization rollback was incomplete",
    );
    const primary = new Error("Failed to write config");
    Object.defineProperty(primary, "cause", { value: rollback, configurable: true });

    expect(toErrorMessage(primary)).toBe(
      [
        "Failed to write config",
        "  Initialization rollback was incomplete",
        "    - failed to restore src/styles/styles.css",
      ].join("\n"),
    );
  });

  it("still reports the failure when the cause chain loops back on itself", () => {
    const rollback = new Error("rollback was incomplete");
    const primary = new Error("Failed to write config", { cause: rollback });
    Object.defineProperty(rollback, "cause", { value: primary, configurable: true });

    const message = toErrorMessage(primary);

    expect(message).toContain("Failed to write config");
    expect(message).toContain("rollback was incomplete");
    expect(message).toContain("... (causes truncated)");
  });

  it("truncates a cause chain too deep to be readable", () => {
    let deepest = new Error("root cause");
    for (let index = 0; index < 30; index++) {
      deepest = new Error(`layer ${index}`, { cause: deepest });
    }

    const message = toErrorMessage(deepest);

    expect(message).toContain("layer 29");
    expect(message).not.toContain("root cause");
    // The primary message, eight cause levels, then the truncation line.
    expect(message.split("\n")).toHaveLength(10);
  });
});

describe("terminal output sanitization", () => {
  it("strips OSC bytes from error output", () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
    error(`failed\x1b]0;evil\x1b\\tail`);
    expect(stderr.mock.calls.flat().join("\n")).not.toContain("\x1b]0;");
    expect(stderr.mock.calls.flat().join("\n")).toContain("failedtail");
    stderr.mockRestore();
  });

  it("escapes bidi controls from info output", () => {
    const stdout = vi.spyOn(console, "log").mockImplementation(() => undefined);
    info(`safe\u202Eevil`);
    const output = stdout.mock.calls.flat().join("\n");
    expect(output).not.toContain("\u202E");
    expect(output).toContain("safe\\u202eevil");
    stdout.mockRestore();
  });
});
