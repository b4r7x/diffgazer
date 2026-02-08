import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  paths: {
    web: resolve(__dirname, "../../web"),
    server: resolve(__dirname, "../../server"),
  },
  ports: {
    api: 3000,
    web: 3001,
  },
} as const;
