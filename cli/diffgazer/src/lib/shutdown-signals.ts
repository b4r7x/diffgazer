/**
 * Signals that must run the coordinated shutdown rather than the default
 * parent-exit path. SIGHUP (terminal or SSH hangup) and SIGQUIT matter because
 * dev children lead detached POSIX process groups: without an explicit handler
 * the parent disappears and leaves them holding their ports. Windows has no
 * SIGQUIT, so it is registered only where it exists.
 */
export const SHUTDOWN_SIGNALS: readonly NodeJS.Signals[] =
  process.platform === "win32"
    ? ["SIGINT", "SIGTERM", "SIGHUP"]
    : ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"];
