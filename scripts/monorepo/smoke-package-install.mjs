#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const root = process.cwd();

function run(cmd, options = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    shell: true,
  });
}

function quoteArgs(args) {
  return args.map((arg) => JSON.stringify(arg)).join(" ");
}

function parsePackOutput(raw) {
  const starts = [...raw.matchAll(/[\[{]/g)].map((match) => match.index ?? 0);
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

function withTempProject(workspacePackage, smoke) {
  const tempDir = mkdtempSync(`${tmpdir()}/dg-smoke-`);
  const projectDir = resolve(tempDir);
  let tgzPath = "";
  run("npm -v > /dev/null");

  try {
    run("npm init -y", { cwd: projectDir });
    run("npm pkg set type=module");

    const packOutput = run(
      `pnpm --dir ${JSON.stringify(root)} --filter ${JSON.stringify(workspacePackage)} pack --json`,
      { cwd: root }
    )
      .toString()
      .trim();

    const parsedPack = parsePackOutput(packOutput);
    const packInfo = Array.isArray(parsedPack) ? parsedPack[0] : parsedPack;
    tgzPath = resolve(root, packInfo?.filename || packInfo?.name || "");
    run(`pnpm add ${quoteArgs([tgzPath, ...(smoke.installDeps ?? [])])}`, { cwd: projectDir });
    const result = run(smoke.command, { cwd: projectDir });
    return result.toString().trim();
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
    if (tgzPath.endsWith(".tgz") && existsSync(tgzPath)) {
      rmSync(tgzPath, { force: true });
    }
  }
}

function assertSmoke(name, result, expect = /OK/) {
  if (!expect.test(result)) {
    throw new Error(`Smoke failed for ${name}: expected ${expect}, got ${result.slice(0, 300)}`);
  }
}

const packages = [
  {
    name: "@diffgazer/ui",
    installDeps: ["react@^19.0.0", "react-dom@^19.0.0"],
    command: `node -e ${JSON.stringify("import('@diffgazer/ui/components/button').then(()=>console.log('OK: @diffgazer/ui import')).catch((e)=>{console.error(e); process.exit(1);});")}`,
  },
  {
    name: "@diffgazer/keys",
    installDeps: ["react@^19.0.0"],
    command: `node -e ${JSON.stringify("import('@diffgazer/keys').then(()=>console.log('OK: @diffgazer/keys import')).catch((e)=>{console.error(e); process.exit(1);});")}`,
  },
  {
    name: "diffgazer",
    command: "pnpm exec diffgazer --help",
    expect: /Usage:|Diffgazer|diffgazer/i,
  },
  {
    name: "@diffgazer/add",
    command: "pnpm exec dgadd --help",
    expect: /Usage: dgadd|Install Diffgazer UI/i,
  },
];

for (const item of packages) {
  const result = withTempProject(item.name, item);
  console.log(result);
  assertSmoke(item.name, result, item.expect);
}

console.log("OK: package install smoke tests passed");
