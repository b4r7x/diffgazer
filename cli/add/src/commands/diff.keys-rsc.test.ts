import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addCommand } from "./add/command.js";
import { diffCommand } from "./diff.js";

let root: string;

function seedRscProject(): void {
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", type: "module" }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./src/*"] } } }),
  );
  writeFileSync(
    join(root, "diffgazer.json"),
    `${JSON.stringify(
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
        rsc: true,
      },
      null,
      2,
    )}\n`,
  );
  mkdirSync(join(root, "src/styles"), { recursive: true });
  writeFileSync(join(root, "src/styles/styles.css"), "");
}

function createCliProgram() {
  return createCli({
    name: "dgadd-diff-keys-rsc-test",
    displayName: "DIFFGAZER DIFF KEYS RSC TEST",
    description: "keys add→diff parity under rsc:true",
    version: "0.0.0",
    commands: [addCommand, diffCommand],
  });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-diff-keys-rsc-"));
  seedRscProject();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("keys add→diff parity with rsc:true", () => {
  test("diff reports keys/navigation up to date after add (no spurious use client injection)", async () => {
    const program = createCliProgram();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await program.parseAsync(["add", "keys/navigation", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const dispatchPath = join(root, "src/hooks/utils/navigation-dispatch.ts");
    const dispatchContent = readFileSync(dispatchPath, "utf-8");
    expect(dispatchContent).not.toMatch(/^"use client";/m);

    log.mockClear();
    await program.parseAsync(["diff", "keys/navigation", "--cwd", root], { from: "user" });
    const diffOutput = log.mock.calls.flat().join("\n");
    expect(diffOutput).toContain("up to date");
    expect(diffOutput).not.toContain("changed");

    log.mockRestore();
  });
});
