import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { openWebUi } from "../lib/web-ui.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WebCommandOptions {
  port?: string;
  serverPort?: string;
}

export async function webCommand(options: WebCommandOptions): Promise<void> {
  const webPort = options.port || "5173";
  const serverPort = options.serverPort || "7860";

  console.log("Starting Stargazer Web UI...");

  // Start the backend server
  const serverDir = path.resolve(__dirname, "../../../server");
  const serverProcess = spawn("pnpm", ["dev"], {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, PORT: serverPort },
  });

  // Use shared openWebUi function for web server management
  await openWebUi({
    apiUrl: `http://127.0.0.1:${serverPort}`,
    webPort,
  });

  // Handle cleanup
  const cleanup = () => {
    serverProcess.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
