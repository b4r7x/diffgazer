import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const configPath = join(packageRoot, "tsconfig.config.json");

const formatDiagnostics = (diagnostics: readonly ts.Diagnostic[]): string =>
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packageRoot,
    getNewLine: () => "\n",
  });

describe("root executable TypeScript configs", () => {
  it("type-checks both package configs with resolved Node types", () => {
    const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(loaded.error ? formatDiagnostics([loaded.error]) : undefined).toBeUndefined();

    const parsed = ts.parseJsonConfigFileContent(
      loaded.config as object,
      ts.sys,
      packageRoot,
      undefined,
      configPath,
    );
    expect(formatDiagnostics(parsed.errors)).toBe("");

    const actualRoots = parsed.fileNames.map((fileName) => realpathSync.native(fileName)).sort();
    const expectedRoots = ["tsup.config.ts", "vitest.config.ts"]
      .map((fileName) => realpathSync.native(join(packageRoot, fileName)))
      .sort();
    expect(actualRoots).toEqual(expectedRoots);
    expect(parsed.options.types).toEqual(["node"]);

    const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
    expect(
      program
        .getSourceFiles()
        .some((sourceFile) =>
          sourceFile.fileName.replaceAll("\\", "/").endsWith("/@types/node/index.d.ts"),
        ),
    ).toBe(true);
    expect(formatDiagnostics(ts.getPreEmitDiagnostics(program))).toBe("");
  });

  it("keeps the root-config project in the advertised type-check command", () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    const invocations = packageJson.scripts?.["type-check"]
      ?.split("&&")
      .map((command) => command.trim().split(/\s+/));

    expect(invocations).toContainEqual(["tsc", "--noEmit", "-p", "tsconfig.config.json"]);
  });
});
