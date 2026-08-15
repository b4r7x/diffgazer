import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCli } from "./program.js";
import { promptSelect, showBanner } from "./terminal.js";

// Boundary mock: the banner renderer and the interactive prompt are the two
// terminal side effects this suite asserts on.
vi.mock("./terminal.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./terminal.js")>();
  return { ...actual, showBanner: vi.fn(), promptSelect: vi.fn() };
});

const originalNodeVersion = process.versions.node;

function setNodeVersion(version: string): void {
  Object.defineProperty(process.versions, "node", {
    configurable: true,
    enumerable: true,
    value: version,
  });
  Object.defineProperty(process, "version", {
    configurable: true,
    enumerable: true,
    value: `v${version}`,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  setNodeVersion(originalNodeVersion);
});

describe("createCli Node runtime floor", () => {
  it("rejects Node releases below 22", () => {
    setNodeVersion("21.7.3");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit ${code}`);
    });

    expect(() =>
      createCli({
        name: "dgadd",
        displayName: "dgadd",
        description: "Registry CLI",
        version: "1.0.0",
        commands: [],
      }),
    ).toThrow("exit 1");
    expect(error).toHaveBeenCalledWith("dgadd requires Node.js >= 22. Current: v21.7.3");
  });

  it("accepts Node 22", () => {
    setNodeVersion("22.0.0");
    const exit = vi.spyOn(process, "exit");

    createCli({
      name: "dgadd",
      displayName: "dgadd",
      description: "Registry CLI",
      version: "1.0.0",
      commands: [],
    });

    expect(exit).not.toHaveBeenCalled();
  });
});

describe("createCli banner", () => {
  it("shows the banner once when the interactive menu dispatches a command", async () => {
    const isTTY = process.stdout.isTTY;
    const argv = process.argv;
    process.stdout.isTTY = true;
    process.argv = ["node", "dgadd"];
    vi.mocked(showBanner).mockClear();
    vi.mocked(promptSelect).mockResolvedValue("add");
    const run = vi.fn();

    try {
      const program = createCli({
        name: "dgadd",
        displayName: "dgadd",
        description: "Registry CLI",
        version: "1.0.0",
        commands: [new Command("add").action(run)],
        menuItems: [{ value: "add", label: "Add an item" }],
      });
      await program.parseAsync([], { from: "user" });
    } finally {
      process.stdout.isTTY = isTTY;
      process.argv = argv;
    }

    expect(run).toHaveBeenCalledTimes(1);
    expect(showBanner).toHaveBeenCalledTimes(1);
  });
});
