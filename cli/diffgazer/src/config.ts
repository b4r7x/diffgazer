import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

export const config = {
  paths: {
    web: resolve(repoRoot, "apps/web"),
    server: resolve(repoRoot, "libs/server"),
  },
  ports: {
    api: 3000,
    web: 3001,
  },
} as const;
