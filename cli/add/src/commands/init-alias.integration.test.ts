import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCli } from "@diffgazer/registry/cli";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { detectProject } from "../utils/detect.js";
import { addCommand } from "./add/command.js";
import { initCommand } from "./init.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dgadd-init-alias-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("baseUrl src wildcard alias", () => {
  test("initializes and installs under a baseUrl src wildcard alias", async () => {
    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({
        name: "fixture",
        type: "module",
        packageManager: "npm@10.9.2",
        devDependencies: { tailwindcss: "^4.1.0" },
      }),
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: "./src",
          paths: { "@/*": ["*"] },
        },
      }),
    );

    expect(detectProject(root)).toMatchObject({
      hasPathAlias: true,
      importAliasPrefix: "@",
      sourceDir: "src",
    });

    const init = createCli({
      name: "dgadd-base-url-init-test",
      displayName: "DGADD BASE URL INIT TEST",
      description: "baseUrl init regression",
      version: "0.0.0",
      commands: [initCommand],
    });
    await init.parseAsync(["init", "--cwd", root, "--yes", "--skip-install"], {
      from: "user",
    });

    const config = JSON.parse(readFileSync(join(root, "diffgazer.json"), "utf-8")) as {
      aliases: Record<string, string>;
      componentsFsPath: string;
      hooksFsPath: string;
      libFsPath: string;
      tailwind: { css: string };
    };
    expect(config).toMatchObject({
      aliases: {
        components: "@/components/ui",
        hooks: "@/hooks",
        lib: "@/lib",
        utils: "@/lib/utils",
      },
      componentsFsPath: "src/components/ui",
      hooksFsPath: "src/hooks",
      libFsPath: "src/lib",
      tailwind: { css: "src/styles/styles.css" },
    });

    const add = createCli({
      name: "dgadd-base-url-add-test",
      displayName: "DGADD BASE URL ADD TEST",
      description: "baseUrl add regression",
      version: "0.0.0",
      commands: [addCommand],
    });
    await add.parseAsync(
      ["add", "ui/button", "--integration", "none", "--cwd", root, "--yes", "--skip-install"],
      { from: "user" },
    );

    expect(existsSync(join(root, "src/components/ui/button/button.tsx"))).toBe(true);
    expect(existsSync(join(root, "components/ui/button/button.tsx"))).toBe(false);
  });
});
