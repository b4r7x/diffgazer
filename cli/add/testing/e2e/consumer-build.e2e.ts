import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { repoRoot, runDgadd, writeFixtureConfig } from "./test-helpers.js";

// The stock `pnpm create vite --template react-ts` app pins types to ["vite/client"],
// which suppresses the automatic @types/* sweep and leaves `process` undeclared. Copied
// source that reads a bare `process` therefore fails the consumer's first `pnpm build`
// with TS2591, a break libs/ui's own node-typed tsconfig can never surface.
const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2023", "DOM", "DOM.Iterable"],
    module: "ESNext",
    moduleResolution: "bundler",
    moduleDetection: "force",
    jsx: "react-jsx",
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    types: ["vite/client"],
    baseUrl: ".",
    paths: { "@/*": ["./src/*"] },
  },
  include: ["src"],
};

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-consumer-"));
  writeFixtureConfig(root);
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify(CONSUMER_TSCONFIG, null, 2));
  // react, react-dom, clsx, tailwind-merge, cva, vite/client and (for package mode) @diffgazer/keys --
  // libs/ui's workspace link to libs/keys' built dist, the files the tarball ships -- all resolve from
  // the library workspace, so the fixture type-checks offline against the versions we ship.
  symlinkSync(resolve(repoRoot, "libs/ui/node_modules"), join(root, "node_modules"), "dir");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function copiedSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry);
    if (statSync(entryPath).isDirectory()) {
      files.push(...copiedSourceFiles(entryPath));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectSideEffectImports(fixtureRoot: string): string[] {
  const srcRoot = join(fixtureRoot, "src");
  if (!existsSync(srcRoot)) return [];

  const imports: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue;
      const relativePath = relative(srcRoot, absolutePath).replace(/\\/g, "/");
      const withoutExtension = relativePath.replace(/\.tsx?$/, "");
      imports.push(`@/${withoutExtension}`);
    }
  };
  visit(srcRoot);
  return imports;
}

// Every child deadline here stays under the enclosing test deadline: a synchronous
// spawn blocks the worker event loop, so vitest's own timer cannot end a wedged run.
const ADD_TIMEOUT_MS = 60_000;
const ADD_ALL_TIMEOUT_MS = 140_000;
const TYPE_CHECK_TIMEOUT_MS = 100_000;

function typeCheckFixture(): { status: number | null; output: string } {
  const result = spawnSync(
    process.execPath,
    [resolve(repoRoot, "node_modules/typescript/bin/tsc"), "-p", join(root, "tsconfig.json")],
    { cwd: root, encoding: "utf-8", timeout: TYPE_CHECK_TIMEOUT_MS, killSignal: "SIGKILL" },
  );
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("copy-mode output builds in a stock Vite react-ts consumer", () => {
  test(
    "copied ui/select and ui/dialog type-check without @types/node",
    { timeout: 180_000 },
    () => {
      runDgadd(
        [
          "add",
          "ui/select",
          "ui/dialog",
          "--integration",
          "copy",
          "--cwd",
          root,
          "--yes",
          "--skip-install",
        ],
        { timeoutMs: ADD_TIMEOUT_MS },
      );

      // A vacuous pass would be indistinguishable from a real one, so prove the
      // type-check had copied component and hook source to run against.
      expect(existsSync(join(root, "src/components/ui/select/select-content.tsx"))).toBe(true);
      expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(true);

      // TS2591 only fires on an undeclared read; a consumer whose bundler happens to
      // define `process` would still ship dead dev branches, so the env read itself is
      // the contract.
      const envReaders = copiedSourceFiles(join(root, "src")).filter((file) =>
        readFileSync(file, "utf-8").includes("process.env"),
      );
      expect(envReaders, "copied source must not read process.env").toEqual([]);

      const { status, output } = typeCheckFixture();

      expect(output, "copied source must not reference an undeclared global").not.toMatch(/TS2591/);
      expect(status, output).toBe(0);
    },
  );

  test(
    "dgadd add --all emitted catalog type-checks in a stock Vite consumer",
    { timeout: 300_000 },
    () => {
      mkdirSync(join(root, "src/styles"), { recursive: true });
      writeFileSync(join(root, "src/styles/styles.css"), '@import "./theme.css";\n');

      runDgadd(["add", "--all", "--cwd", root, "--yes", "--skip-install"], {
        timeoutMs: ADD_ALL_TIMEOUT_MS,
      });

      const imports = collectSideEffectImports(root);
      expect(imports.length).toBeGreaterThan(50);
      writeFileSync(
        join(root, "src/main.tsx"),
        `${imports.map((specifier) => `import "${specifier}";`).join("\n")}\n`,
      );

      const envReaders = copiedSourceFiles(join(root, "src")).filter((file) =>
        readFileSync(file, "utf-8").includes("process.env"),
      );
      expect(envReaders, "copied source must not read process.env").toEqual([]);

      const { status, output } = typeCheckFixture();

      expect(output, "copied --all catalog must not reference undeclared globals").not.toMatch(
        /TS2591/,
      );
      expect(status, output).toBe(0);
    },
  );
});

describe("keys-package output builds in a stock Vite react-ts consumer", () => {
  test("ui/select installed against @diffgazer/keys type-checks", { timeout: 180_000 }, () => {
    runDgadd(
      ["add", "ui/select", "--integration", "keys", "--cwd", root, "--yes", "--skip-install"],
      { timeoutMs: ADD_TIMEOUT_MS },
    );

    // Package mode must leave the keys hooks in the package: no copied use-navigation, and the
    // component reaching for the published entry point instead.
    expect(existsSync(join(root, "src/hooks/use-navigation.ts"))).toBe(false);
    const packageImporters = copiedSourceFiles(join(root, "src")).filter((file) =>
      readFileSync(file, "utf-8").includes('from "@diffgazer/keys"'),
    );
    expect(packageImporters.length).toBeGreaterThan(0);

    const { status, output } = typeCheckFixture();

    expect(status, output).toBe(0);
  });
});
