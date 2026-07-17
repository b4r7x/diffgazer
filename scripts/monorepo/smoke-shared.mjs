import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { ENV } from "./lib/env.mjs";

export function joinLines(...lines) {
  return lines.join("\n");
}

export class CommandFailedError extends Error {
  constructor(cmd, { exitCode, stdout, stderr, cause } = {}) {
    super(`Command failed (exit ${exitCode}): ${cmd}`);
    this.name = "CommandFailedError";
    this.cmd = cmd;
    this.exitCode = exitCode ?? null;
    this.stdout = stdout ?? "";
    this.stderr = stderr ?? "";
    if (cause !== undefined) this.cause = cause;
  }

  get output() {
    return `${this.stdout}${this.stderr}`;
  }
}

export class CommandTimedOutError extends Error {
  constructor(cmd, { timeoutMs, stdout, stderr, cause }) {
    super(`Command timed out after ${timeoutMs}ms: ${cmd}`);
    this.name = "CommandTimedOutError";
    this.cmd = cmd;
    this.timeoutMs = timeoutMs;
    this.stdout = stdout;
    this.stderr = stderr;
    if (cause !== undefined) this.cause = cause;
  }

  get output() {
    return `${this.stdout}${this.stderr}`;
  }
}

const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;
const DEFAULT_TERMINATION_GRACE_MS = 1_000;
const PROCESS_GROUP_EXIT_TIMEOUT_MS = 5_000;
const SUPPORTS_PROCESS_GROUPS = process.platform !== "win32";

function signalProcessTree(child, processGroupId, signal) {
  try {
    if (processGroupId) process.kill(-processGroupId, signal);
    else if (child.exitCode === null && child.signalCode === null) child.kill(signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

function processGroupExists(processGroupId) {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    if (error?.code === "EPERM") return true;
    throw error;
  }
}

async function waitForProcessGroupExit(processGroupId) {
  const deadline = Date.now() + PROCESS_GROUP_EXIT_TIMEOUT_MS;
  while (processGroupExists(processGroupId)) {
    if (Date.now() >= deadline) return false;
    await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
  }
  return true;
}

export function resolveAndCollectMissing(deps, resolveFn) {
  const missing = [];
  for (const dep of deps) {
    try {
      resolveFn(dep);
    } catch {
      missing.push(dep);
    }
  }
  return missing;
}

export function packageNameFromSpec(spec) {
  if (spec.startsWith("/") || spec.startsWith(".")) return null;
  if (spec.startsWith("@")) {
    const [scope, rest = ""] = spec.split("/");
    const name = rest.split("@")[0];
    return name ? `${scope}/${name}` : null;
  }
  return spec.split("@")[0] || null;
}

export function networkAllowed() {
  return process.env[ENV.smokeAllowNetwork] === "1";
}

export async function fetchJsonWithLimit(url, { fetchImpl = fetch, label, maxBytes, signal }) {
  const response = await fetchImpl(url, { redirect: "error", signal });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);

  const declaredLength = response.headers.get("content-length")?.trim();
  if (declaredLength && /^\d+$/.test(declaredLength)) {
    const declaredBytes = Number(declaredLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maxBytes) {
      throw new Error(`${label}: response exceeds ${maxBytes} bytes`);
    }
  }

  if (!response.body) throw new Error(`${label}: response body is empty`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      const message = `${label}: response exceeds ${maxBytes} bytes`;
      await reader.cancel(message);
      throw new Error(message);
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text);
}

export function pnpmAddFlags() {
  return networkAllowed() ? ["--fetch-retries=0"] : ["--offline", "--fetch-retries=0"];
}

export function resolveLocalDependency(root, packageName) {
  for (const dir of ["apps/web", "libs/ui", "libs/keys", "."]) {
    const depPath = resolve(root, dir, "node_modules", ...packageName.split("/"));
    if (existsSync(depPath)) return `link:${realpathSync(depPath)}`;
  }
  throw new Error(`Cannot resolve local dependency for smoke test: ${packageName}`);
}

const TAILWIND_V4_SPEC = "^4.0.0";

export function declareTailwindV4Dependency(fixture) {
  const packageJsonPath = resolve(fixture, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  if (packageJson.dependencies) {
    delete packageJson.dependencies.tailwindcss;
    if (Object.keys(packageJson.dependencies).length === 0) delete packageJson.dependencies;
  }
  packageJson.devDependencies = {
    ...(packageJson.devDependencies ?? {}),
    tailwindcss: TAILWIND_V4_SPEC,
  };
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function viteFixtureDependencySpecs(root) {
  return [
    "react",
    "react-dom",
    "@types/react",
    "@types/react-dom",
    "@types/node",
    "typescript",
    "vite",
    "@vitejs/plugin-react",
    "tailwindcss",
    "@tailwindcss/vite",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ].map((packageName) => resolveLocalDependency(root, packageName));
}

export async function installViteFixtureDeps(root, fixture) {
  await runArgv(
    "pnpm",
    ["add", "--offline", "--fetch-retries=0", ...viteFixtureDependencySpecs(root)],
    fixture,
  );
  declareTailwindV4Dependency(fixture);
}

export function writeViteFixture(fixture, options = {}) {
  const {
    name = "dgadd-smoke",
    packageManager,
    withLibUtils = false,
    indexCss,
    componentsJson = false,
    componentRegistries,
  } = options;
  mkdirSync(resolve(fixture, "src"), { recursive: true });
  if (withLibUtils) {
    mkdirSync(resolve(fixture, "src/lib"), { recursive: true });
  }

  const packageJson = {
    name,
    private: true,
    type: "module",
    ...(packageManager ? { packageManager } : {}),
    devDependencies: { tailwindcss: TAILWIND_V4_SPEC },
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      build: "vite build",
    },
  };

  writeFileSync(resolve(fixture, "package.json"), JSON.stringify(packageJson, null, 2));
  writeFileSync(
    resolve(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["DOM", "DOM.Iterable", "ES2023"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
        include: ["src"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "vite.config.mjs"),
    joinLines(
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      "  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },",
      "});",
      "",
    ),
  );
  writeFileSync(
    resolve(fixture, "index.html"),
    `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`,
  );

  if (withLibUtils) {
    writeFileSync(
      resolve(fixture, "src/lib/utils.ts"),
      joinLines(
        'import { type ClassValue, clsx } from "clsx";',
        'import { twMerge } from "tailwind-merge";',
        "",
        "export function cn(...inputs: ClassValue[]) {",
        "  return twMerge(clsx(inputs));",
        "}",
        "",
      ),
    );
  }

  if (indexCss) {
    writeFileSync(
      resolve(fixture, "src/index.css"),
      Array.isArray(indexCss) ? indexCss.join("\n") : indexCss,
    );
  }

  if (componentsJson) {
    writeFileSync(
      resolve(fixture, "components.json"),
      JSON.stringify(
        {
          $schema: "https://ui.shadcn.com/schema.json",
          ...(componentRegistries ? { registries: componentRegistries } : {}),
          style: "new-york",
          rsc: false,
          tsx: true,
          tailwind: {
            config: "",
            css: "src/index.css",
            baseColor: "neutral",
            cssVariables: true,
            prefix: "",
          },
          iconLibrary: "lucide",
          aliases: {
            components: "@/components",
            utils: "@/lib/utils",
            ui: "@/components/ui",
            lib: "@/lib",
            hooks: "@/hooks",
          },
        },
        null,
        2,
      ),
    );
  }
}

export function writeNextFixture(fixture, options = {}) {
  const {
    root,
    name = "dgadd-next-smoke",
    withSrc = false,
    paths = false,
    include = withSrc
      ? ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx", "src/**/*.ts", "src/**/*.tsx"]
      : ["next-env.d.ts", "app/**/*.ts", "app/**/*.tsx"],
  } = options;

  mkdirSync(resolve(fixture, "app"), { recursive: true });
  if (withSrc) {
    mkdirSync(resolve(fixture, "src"), { recursive: true });
  }

  writeFileSync(
    resolve(fixture, "package.json"),
    JSON.stringify(
      {
        name,
        private: true,
        type: "module",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["DOM", "DOM.Iterable", "ES2023"],
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "preserve",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          allowJs: false,
          resolveJsonModule: true,
          isolatedModules: true,
          incremental: true,
          ...(paths ? { baseUrl: ".", paths: { "@/*": ["./src/*"] } } : {}),
          plugins: [{ name: "next" }],
        },
        include,
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    resolve(fixture, "next.config.mjs"),
    [
      "export default {",
      ...(root ? [`  turbopack: { root: ${JSON.stringify(root)} },`] : []),
      "};",
      "",
    ].join("\n"),
  );
  writeFileSync(
    resolve(fixture, "postcss.config.mjs"),
    "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
  );
  writeFileSync(
    resolve(fixture, "next-env.d.ts"),
    '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
  );
}

export function uiSmokeAppBody(label) {
  return [
    '    <main className="min-h-screen bg-background text-foreground p-6">',
    `      <Button variant="primary">${label} Button</Button>`,
    "      <Dialog defaultOpen>",
    "        <DialogContent>",
    `          <DialogHeader><DialogTitle>${label} Dialog</DialogTitle></DialogHeader>`,
    '          <DialogBody><p className="text-sm text-muted-foreground">Dialog content</p></DialogBody>',
    '          <DialogFooter><DialogClose variant="ghost">Close</DialogClose></DialogFooter>',
    "          <DialogCloseIcon />",
    "        </DialogContent>",
    "      </Dialog>",
    '      <Select defaultOpen defaultValue="main" width="md">',
    '        <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>',
    "        <SelectContent>",
    '          <SelectItem value="main">main</SelectItem>',
    '          <SelectItem value="develop">develop</SelectItem>',
    "        </SelectContent>",
    "      </Select>",
    "    </main>",
  ];
}

export function skipMissingSmokeDeps(label, missing) {
  if (missing.length === 0) return false;

  if (process.env[ENV.smokeStrictSkips] === "1") {
    throw new Error(
      `Required smoke dependencies missing for ${label}: ${missing.join(", ")}. ` +
        `Install them locally or set ${ENV.smokeAllowNetwork}=1.`,
    );
  }

  console.log(
    `SKIP: ${label} (missing local dependencies: ${missing.join(", ")}; ` +
      `set ${ENV.smokeAllowNetwork}=1 to install them, or ${ENV.smokeStrictSkips}=1 to fail on skips)`,
  );
  return true;
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = resolve(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function readBuiltCss(fixture, outputDir = "dist") {
  return listFiles(resolve(fixture, outputDir))
    .filter((path) => path.endsWith(".css"))
    .map((path) => readFileSync(path, "utf-8"))
    .join("\n");
}

export function assertBuiltCss(fixture, options = {}) {
  const {
    outputDir = "dist",
    label = "built",
    expected = [".bg-primary", ".w-64", "--base-bg", "dialog::backdrop"],
  } = options;
  const css = readBuiltCss(fixture, outputDir);

  for (const value of expected) {
    if (!css.includes(value)) {
      throw new Error(`${label} CSS is missing ${value}`);
    }
  }
}

export function runArgv(command, args, cwdOrOptions = {}) {
  const options = typeof cwdOrOptions === "string" ? { cwd: cwdOrOptions } : cwdOrOptions;
  const cmdLabel = `${command} ${args.join(" ")}`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;

  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : undefined,
      stdio: ["ignore", "pipe", "pipe"],
      detached: SUPPORTS_PROCESS_GROUPS,
    });
    const processGroupId = SUPPORTS_PROCESS_GROUPS ? child.pid : undefined;
    let stdout = "";
    let stderr = "";
    let spawnError;
    let timedOut = false;
    let directClosed = false;
    let directExitCode = null;
    let terminationFinished = false;
    let terminationError;
    let settled = false;
    let killTimer;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      spawnError = error;
    });

    const settle = () => {
      if (settled || !directClosed || (timedOut && !terminationFinished)) return;
      settled = true;

      if (timedOut) {
        rejectPromise(
          new CommandTimedOutError(cmdLabel, {
            timeoutMs,
            stdout,
            stderr,
            cause: terminationError,
          }),
        );
        return;
      }
      if (spawnError) {
        rejectPromise(
          new CommandFailedError(cmdLabel, { exitCode: null, stdout, stderr, cause: spawnError }),
        );
        return;
      }
      if (directExitCode !== 0) {
        rejectPromise(
          new CommandFailedError(cmdLabel, { exitCode: directExitCode, stdout, stderr }),
        );
        return;
      }
      resolvePromise(stdout);
    };

    const finishTermination = async () => {
      try {
        signalProcessTree(child, processGroupId, "SIGKILL");
        if (processGroupId && !(await waitForProcessGroupExit(processGroupId))) {
          throw new Error(
            `Process group ${processGroupId} remained alive after SIGKILL for ${PROCESS_GROUP_EXIT_TIMEOUT_MS}ms`,
          );
        }
      } catch (error) {
        terminationError ??= error;
      }
      terminationFinished = true;
      settle();
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        signalProcessTree(child, processGroupId, "SIGTERM");
      } catch (error) {
        terminationError = error;
      }
      killTimer = setTimeout(() => void finishTermination(), terminationGraceMs);
    }, timeoutMs);

    child.once("close", (exitCode) => {
      directClosed = true;
      directExitCode = exitCode;
      clearTimeout(timeout);
      if (!timedOut) clearTimeout(killTimer);
      settle();
    });
  });
}

export function parsePackOutput(raw) {
  const starts = [...raw.matchAll(/[[{]/g)].map((match) => match.index ?? 0);
  const ends = [...raw.matchAll(/[\]}]/g)].map((match) => match.index ?? 0).reverse();

  for (const start of starts) {
    for (const end of ends) {
      if (end <= start) continue;
      const candidate = raw.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
        if (packInfo?.filename) return parsed;
      } catch {
        // pnpm lifecycle logs can be mixed into stdout; keep scanning.
      }
    }
  }

  throw new Error(`Could not parse pnpm pack --json output:\n${raw.slice(0, 1000)}`);
}

// pnpm pack --json reports `filename` as an absolute path or a bare filename depending on
// version/destination; resolve both forms against packDir.
export async function packWorkspacePackage(root, workspacePackage, packDir) {
  const packOutput = (
    await runArgv(
      "pnpm",
      [
        "--dir",
        root,
        "--filter",
        workspacePackage,
        "pack",
        "--pack-destination",
        packDir,
        "--json",
      ],
      {
        cwd: root,
        timeoutMs: 900_000,
      },
    )
  ).trim();

  const parsedPack = parsePackOutput(packOutput);
  const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
  return isAbsolute(packInfo.filename)
    ? packInfo.filename
    : join(packDir, basename(packInfo.filename));
}
