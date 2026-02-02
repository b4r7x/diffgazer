import { exec, spawn, type ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, "../../../web");
const DEFAULT_WEB_PORT = 5173;
const WEB_LOG_LIMIT = 4000;

let webProcess: ChildProcess | null = null;
let cleanupRegistered = false;
let webLogBuffer = "";

function appendWebLogs(chunk: Buffer | string): void {
  const next = `${webLogBuffer}${chunk.toString()}`;
  webLogBuffer = next.length > WEB_LOG_LIMIT ? next.slice(-WEB_LOG_LIMIT) : next;
}

function clearWebLogs(): void {
  webLogBuffer = "";
}

function printWebLogs(): void {
  if (!webLogBuffer.trim()) return;
  console.error("Web UI logs (last output):");
  console.error(webLogBuffer.trim());
}

function normalizeApiUrl(apiUrl: string): string {
  try {
    const url = new URL(apiUrl);
    if (url.hostname === "localhost" || url.hostname === "0.0.0.0") {
      url.hostname = "127.0.0.1";
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return apiUrl;
  }
}

async function waitForServer(url: string, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Web UI at ${url} did not start within ${timeout}ms`);
}

async function isServerUp(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
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

function registerCleanup(): void {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    if (webProcess) {
      webProcess.kill();
      webProcess = null;
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

export interface OpenWebUiOptions {
  apiUrl: string;
  webPort?: number | string;
}

export async function openWebUi(options: OpenWebUiOptions): Promise<void> {
  const port = typeof options.webPort === "string" ? Number.parseInt(options.webPort, 10) : options.webPort;
  const webPort = Number.isFinite(port) ? (port as number) : DEFAULT_WEB_PORT;
  const webUrl = `http://127.0.0.1:${webPort}`;
  const apiUrl = normalizeApiUrl(options.apiUrl);

  const isRunning = await isServerUp(webUrl);

  if (!isRunning && !webProcess) {
    console.log(`\n🌐 Starting Web UI at ${webUrl}`);
    console.log(`📡 API server at ${apiUrl}`);

    clearWebLogs();
    webProcess = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], {
      cwd: WEB_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, VITE_API_URL: apiUrl },
    });

    webProcess.stdout?.on("data", appendWebLogs);
    webProcess.stderr?.on("data", appendWebLogs);

    webProcess.on("exit", (code, signal) => {
      if (code !== 0) {
        console.error(`Web UI exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}`);
        printWebLogs();
      }
      webProcess = null;
    });

    webProcess.on("error", (error) => {
      console.error("Failed to start web UI:", error);
      printWebLogs();
      webProcess = null;
    });

    registerCleanup();
  } else {
    console.log(`\n🌐 Opening Web UI at ${webUrl}`);
    console.log(`📡 API server at ${apiUrl}`);
  }

  try {
    if (!isRunning) {
      await waitForServer(webUrl);
    }
    openBrowser(webUrl);
  } catch (error) {
    console.error("Failed to start web UI:", error);
    printWebLogs();
  }
}
