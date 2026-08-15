#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const webRoot = resolve(packageRoot, "../../apps/web");
const outDir = process.env.DIFFGAZER_EMBEDDED_WEB_OUT_DIR
  ? resolve(process.env.DIFFGAZER_EMBEDDED_WEB_OUT_DIR)
  : resolve(packageRoot, "dist/web");

const env = { ...process.env };
delete env.VITE_API_URL;
delete env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
env.VITE_API_URL = "";
env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = "";

execFileSync("pnpm", ["exec", "tsc", "-b", "tsconfig.app.json"], {
  cwd: webRoot,
  env,
  stdio: "inherit",
});

execFileSync(
  "pnpm",
  ["exec", "vite", "build", "--config", "vite.embedded.config.ts", "--outDir", outDir],
  {
    cwd: webRoot,
    env,
    stdio: "inherit",
  },
);
