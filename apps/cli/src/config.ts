import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
