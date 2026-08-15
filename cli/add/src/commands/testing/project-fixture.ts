import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TSCONFIG = {
  compilerOptions: { baseUrl: ".", paths: { "@/*": ["./src/*"] } },
};

const DIFFGAZER_CONFIG = {
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
};

export interface ProjectFixtureOptions {
  /** Package manifest contents; omit to leave the fixture without a package.json. */
  packageJson?: object;
  /** Stylesheet contents for the configured Tailwind entry; omit to leave src/styles absent. */
  stylesCss?: string;
}

/**
 * Writes the initialized-dgadd-project baseline that command fixtures start from:
 * the `@/*` tsconfig and the alias / filesystem-path / Tailwind config every
 * command reads. Scenario-specific manifest state stays in the calling test.
 */
export function writeProjectFixture(root: string, options: ProjectFixtureOptions = {}): void {
  if (options.packageJson) {
    writeFileSync(join(root, "package.json"), JSON.stringify(options.packageJson, null, 2));
  }
  writeFileSync(join(root, "tsconfig.json"), JSON.stringify(TSCONFIG, null, 2));
  writeFileSync(join(root, "diffgazer.json"), JSON.stringify(DIFFGAZER_CONFIG, null, 2));
  if (options.stylesCss !== undefined) {
    mkdirSync(join(root, "src/styles"), { recursive: true });
    writeFileSync(join(root, "src/styles/styles.css"), options.stylesCss);
  }
}
