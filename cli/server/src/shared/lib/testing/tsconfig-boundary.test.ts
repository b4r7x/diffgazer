import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SERVER_ROOT = path.resolve(import.meta.dirname, "../../../..");
const TEST_ONLY_FIXTURES = [
  "src/shared/lib/ai/models-dev-sample.ts",
  "src/shared/lib/testing/factories.ts",
  "src/shared/lib/testing/http.ts",
] as const;

function parseTsConfig(configName: string): ts.ParsedCommandLine {
  const configPath = path.join(SERVER_ROOT, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, SERVER_ROOT, {}, configPath);
  if (parsed.errors.length > 0) {
    throw new Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
        .join("\n"),
    );
  }
  return parsed;
}

type PathSystem = Pick<ts.System, "realpath" | "useCaseSensitiveFileNames">;

function canonicalPhysicalPath(filePath: string, system: PathSystem = ts.sys): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(SERVER_ROOT, filePath);
  const physicalPath = system.realpath?.(absolutePath) ?? fs.realpathSync.native(absolutePath);
  const normalizedPath = path.normalize(physicalPath);
  return system.useCaseSensitiveFileNames ? normalizedPath : normalizedPath.toLowerCase();
}

describe("TypeScript config boundaries", () => {
  it("keeps fixtures in test roots and out of production roots and transitive sources", () => {
    const productionConfig = parseTsConfig("tsconfig.json");
    const testConfig = parseTsConfig("tsconfig.test.json");
    const productionRootPaths = productionConfig.fileNames.map((fileName) =>
      canonicalPhysicalPath(fileName),
    );
    const testRootPaths = testConfig.fileNames.map((fileName) => canonicalPhysicalPath(fileName));
    const productionSourcePaths = ts
      .createProgram({
        rootNames: productionConfig.fileNames,
        options: productionConfig.options,
      })
      .getSourceFiles()
      .map(({ fileName }) => canonicalPhysicalPath(fileName));

    for (const fixture of TEST_ONLY_FIXTURES) {
      const fixturePath = canonicalPhysicalPath(fixture);
      expect(productionRootPaths).not.toContain(fixturePath);
      expect(productionSourcePaths).not.toContain(fixturePath);
      expect(testRootPaths).toContain(fixturePath);
    }
  });

  it("detects a differently cased fixture in a case-insensitive source graph", () => {
    const fixturePath = path.join(SERVER_ROOT, TEST_ONLY_FIXTURES[0]);
    const compilerPath = fixturePath.toUpperCase();
    const system = {
      useCaseSensitiveFileNames: false,
      realpath: (filePath: string) => filePath,
    };

    expect([canonicalPhysicalPath(compilerPath, system)]).toContain(
      canonicalPhysicalPath(fixturePath, system),
    );
  });
});
