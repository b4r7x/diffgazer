const SHUTDOWN_DELAY_MS = 75;
const SHUTDOWN_SIGNAL: NodeJS.Signals = "SIGTERM";
const SHUTDOWN_UNAVAILABLE_MESSAGE = "Shutdown is not available in this environment.";
const MIN_VALID_PID = 2;

type ShutdownResult = { ok: true } | { ok: false; message: string };

let shutdownScheduled = false;

const scheduleCliTermination = (cliPid: number): void => {
  setTimeout(() => {
    try {
      process.kill(cliPid, SHUTDOWN_SIGNAL);
    } catch (error) {
      console.error("Failed to terminate CLI process via /api/shutdown:", error);
    } finally {
      shutdownScheduled = false;
    }
  }, SHUTDOWN_DELAY_MS);
};

const parseCliPid = (rawPid: string | undefined): number | null => {
  if (!rawPid) return null;
  const parsed = Number.parseInt(rawPid, 10);
  if (!Number.isInteger(parsed) || parsed < MIN_VALID_PID) return null;
  return parsed;
};

const requestShutdown = (): ShutdownResult => {
  if (shutdownScheduled) {
    return { ok: true };
  }

  const cliPid = parseCliPid(process.env.DIFFGAZER_CLI_PID);
  if (!cliPid) {
    return {
      ok: false,
      message: SHUTDOWN_UNAVAILABLE_MESSAGE,
    };
  }

  shutdownScheduled = true;
  scheduleCliTermination(cliPid);
  return { ok: true };
};

const resetShutdownStateForTests = (): void => {
  shutdownScheduled = false;
};

export { requestShutdown, resetShutdownStateForTests };
