import { spawn, exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WebCommandOptions {
  port?: string;
  serverPort?: string;
}

async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;
  
  if (platform === "darwin") {
    command = `open "${url}"`;
  } else if (platform === "win32") {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`Could not open browser automatically. Please open ${url} manually.`);
    }
  });
}

export async function webCommand(options: WebCommandOptions): Promise<void> {
  const webPort = options.port || "5173";
  const serverPort = options.serverPort || "7860";

  console.log("🌐 Starting Stargazer Web UI...");

  // Start the backend server
  const serverDir = path.resolve(__dirname, "../../../server");
  const serverProcess = spawn("pnpm", ["dev"], {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, PORT: serverPort },
  });

  // Start the web dev server
  const webDir = path.resolve(__dirname, "../../../web");
  const webProcess = spawn("pnpm", ["dev", "--port", webPort], {
    cwd: webDir,
    stdio: "inherit",
    env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${serverPort}` },
  });

  // Wait for web server to be ready
  try {
    await waitForServer(`http://127.0.0.1:${webPort}`);
    console.log(`\n✨ Web UI ready at http://127.0.0.1:${webPort}`);
    console.log(`📡 API server at http://127.0.0.1:${serverPort}`);
    console.log("\nPress Ctrl+C to stop\n");

    // Open browser
    openBrowser(`http://127.0.0.1:${webPort}`);
  } catch (error) {
    console.error("Failed to start web UI:", error);
  }

  // Handle cleanup
  const cleanup = () => {
    serverProcess.kill();
    webProcess.kill();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}
