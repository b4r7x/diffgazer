import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const faults = vi.hoisted(() => ({
  trackRemovals: false,
  removeFailureAt: 0,
  sourceRemoveAttempts: 0,
  successfulSourceRemovals: 0,
  writePath: "",
  writeFailureAt: 0,
  matchingWrites: 0,
  deleteBeforeWriteFailure: false,
  renameTarget: "",
  renameFailureAt: 0,
  matchingRenames: 0,
  deleteBeforeRenameFailure: false,
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    rmSync: (...args: Parameters<typeof actual.rmSync>) => {
      const isSourceRemoval = faults.trackRemovals && args[1] === undefined;
      if (isSourceRemoval) {
        faults.sourceRemoveAttempts += 1;
        if (faults.sourceRemoveAttempts === faults.removeFailureAt) {
          throw new Error("injected source deletion failure");
        }
      }
      const result = actual.rmSync(...args);
      if (isSourceRemoval) faults.successfulSourceRemovals += 1;
      return result;
    },
    renameSync: (...args: Parameters<typeof actual.renameSync>) => {
      if (String(args[1]) === faults.renameTarget) {
        faults.matchingRenames += 1;
        if (faults.matchingRenames === faults.renameFailureAt) {
          if (faults.deleteBeforeRenameFailure) actual.rmSync(args[1], { force: true });
          throw new Error(`injected rename failure: ${faults.renameTarget}`);
        }
      }
      return actual.renameSync(...args);
    },
    writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
      if (String(args[0]) === faults.writePath) {
        faults.matchingWrites += 1;
        if (faults.matchingWrites === faults.writeFailureAt) {
          if (faults.deleteBeforeWriteFailure) actual.rmSync(faults.writePath, { force: true });
          throw new Error(`injected write failure: ${faults.writePath}`);
        }
      }
      return actual.writeFileSync(...args);
    },
  };
});

import { DiffgazerAddConfigSchema } from "../context.js";
import { addCommand } from "./add/command.js";
import { removeCommand } from "./remove.js";

type Snapshot = Map<string, Buffer | null>;

let root: string;

function resetFaults(): void {
  faults.trackRemovals = false;
  faults.removeFailureAt = 0;
  faults.sourceRemoveAttempts = 0;
  faults.successfulSourceRemovals = 0;
  faults.writePath = "";
  faults.writeFailureAt = 0;
  faults.matchingWrites = 0;
  faults.deleteBeforeWriteFailure = false;
  faults.renameTarget = "";
  faults.renameFailureAt = 0;
  faults.matchingRenames = 0;
  faults.deleteBeforeRenameFailure = false;
}

function writeFixtureConfig(): void {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ type: "module", devDependencies: { tailwindcss: "^4.0.0" } }),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } } }),
  );
  mkdirSync(join(root, "src/styles"), { recursive: true });
  writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');
  writeFileSync(
    join(root, "diffgazer.json"),
    JSON.stringify(
      {
        aliases: {
          components: "@/components/ui",
          utils: "@/lib/utils",
          lib: "@/lib",
          hooks: "@/hooks",
        },
        componentsFsPath: "src/components/ui",
        libFsPath: "src/lib",
        hooksFsPath: "src/hooks",
        tailwind: { css: "src/styles/styles.css" },
      },
      null,
      2,
    ),
  );
}

async function addDialog(): Promise<void> {
  await addCommand.parseAsync([
    "node",
    "dgadd",
    "ui/dialog",
    "--cwd",
    root,
    "--yes",
    "--skip-install",
  ]);
}

async function removeDialog(): Promise<void> {
  await removeCommand.parseAsync(["node", "dgadd", "ui/dialog", "--cwd", root, "--yes"]);
}

function readConfig() {
  return DiffgazerAddConfigSchema.parse(
    JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")),
  );
}

function ownedSourcePaths(): string[] {
  const paths = new Set<string>();
  for (const record of Object.values(readConfig().installedComponents ?? {})) {
    for (const file of record.files ?? []) paths.add(join(root, file.path));
  }
  return [...paths];
}

function capture(paths: Iterable<string>): Snapshot {
  return new Map(
    [...new Set(paths)].map((path) => [path, existsSync(path) ? readFileSync(path) : null]),
  );
}

function expectSnapshot(snapshot: Snapshot): void {
  for (const [path, content] of snapshot) {
    if (content === null) expect(existsSync(path), path).toBe(false);
    else expect(readFileSync(path), path).toEqual(content);
  }
}

async function expectCommandFailure(action: () => Promise<void>): Promise<void> {
  const exit = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("injected process exit");
  });
  try {
    await expect(action()).rejects.toThrow("injected process exit");
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    exit.mockRestore();
  }
}

beforeEach(async () => {
  resetFaults();
  root = mkdtempSync(join(tmpdir(), "dgadd-remove-transaction-"));
  writeFixtureConfig();
  await addDialog();
});

afterEach(() => {
  resetFaults();
  rmSync(root, { recursive: true, force: true });
});

describe("removeCommand transaction", () => {
  test("restores present and absent sources and CSS after a partial deletion failure, then retries", async () => {
    const sourcePaths = ownedSourcePaths();
    const absentSource = sourcePaths.at(-1);
    if (!absentSource) throw new Error("Expected installed dialog sources");
    rmSync(absentSource);
    const stylesPath = join(root, "src/styles/styles.css");
    rmSync(stylesPath);
    const manifestPath = join(root, "diffgazer.json");
    const before = capture([...sourcePaths, stylesPath, manifestPath]);
    faults.trackRemovals = true;
    faults.removeFailureAt = 2;

    await expectCommandFailure(removeDialog);
    faults.trackRemovals = false;

    expect(faults.successfulSourceRemovals).toBeGreaterThan(0);
    expect(faults.sourceRemoveAttempts).toBeGreaterThan(2);
    expectSnapshot(before);

    await removeDialog();

    expect(sourcePaths.every((path) => !existsSync(path))).toBe(true);
    expect(existsSync(stylesPath)).toBe(false);
    expect(readConfig().installedComponents?.["ui/dialog"]).toBeUndefined();
  });

  test("restores source, CSS, and manifest bytes when the real CSS plan write fails, then retries", async () => {
    const sourcePaths = ownedSourcePaths();
    const stylesPath = join(root, "src/styles/styles.css");
    const manifestPath = join(root, "diffgazer.json");
    const before = capture([...sourcePaths, stylesPath, manifestPath]);
    faults.writePath = stylesPath;
    faults.writeFailureAt = 1;
    faults.deleteBeforeWriteFailure = true;

    await expectCommandFailure(removeDialog);

    expect(faults.matchingWrites).toBeGreaterThanOrEqual(2);
    expectSnapshot(before);

    resetFaults();
    await removeDialog();

    expect(sourcePaths.every((path) => !existsSync(path))).toBe(true);
    expect(readFileSync(stylesPath, "utf-8")).not.toContain("dialog::backdrop");
    expect(readConfig().installedComponents?.["ui/dialog"]).toBeUndefined();
  });

  test("rolls back the second real manifest write for a retained CSS chunk, then retries", async () => {
    const sourcePaths = ownedSourcePaths();
    const stylesPath = join(root, "src/styles/styles.css");
    const manifestPath = join(root, "diffgazer.json");
    const config = readConfig();
    const chunkOwner = Object.entries(config.installedComponents ?? {}).find(
      ([, record]) => (record.cssChunks?.length ?? 0) > 0,
    );
    if (!chunkOwner) throw new Error("Expected a CSS chunk owner");
    const [chunkOwnerName, chunkOwnerRecord] = chunkOwner;
    const editedCss = readFileSync(stylesPath, "utf-8").replace(
      /(dialog::backdrop)/,
      "/* user tuned */\n$1",
    );
    writeFileSync(stylesPath, editedCss);
    const before = capture([...sourcePaths, stylesPath, manifestPath]);
    faults.renameTarget = manifestPath;
    faults.renameFailureAt = 2;
    faults.deleteBeforeRenameFailure = true;

    await expectCommandFailure(removeDialog);

    expect(faults.matchingRenames).toBe(2);
    expectSnapshot(before);

    resetFaults();
    await removeDialog();

    expect(sourcePaths.every((path) => !existsSync(path))).toBe(true);
    expect(readFileSync(stylesPath, "utf-8")).toBe(editedCss);
    const retained = readConfig().installedComponents?.[chunkOwnerName];
    expect(retained?.cssChunks).toEqual(chunkOwnerRecord.cssChunks);
    expect(retained?.files).toBeUndefined();
  });
});
