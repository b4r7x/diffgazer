import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

export function runDgadd(
  args: string[],
  opts?: { silent?: boolean; env?: NodeJS.ProcessEnv },
): string {
  const silent = opts?.silent ?? true;
  return execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(repoRoot, "cli/add/src/index.ts"),
      ...(silent ? ["--silent"] : []),
      ...args,
    ],
    { cwd: repoRoot, encoding: "utf-8", env: opts?.env ?? process.env },
  );
}

export function writeFixtureConfig(root: string): void {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ type: "module", devDependencies: { tailwindcss: "^4.0.0" } }),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
    }),
  );
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
