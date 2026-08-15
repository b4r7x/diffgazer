import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import baseConfig from "./vite.config";

const packageRoot = path.resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../cli/diffgazer",
);

export default mergeConfig(baseConfig, {
  envDir: path.join(packageRoot, "embedded-build-env"),
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(""),
    "import.meta.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN": JSON.stringify(""),
  },
});
