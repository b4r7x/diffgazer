const COLORS = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
} as const;

const RESET = "\x1b[0m";

type LogLevel = keyof typeof COLORS;

function log(level: LogLevel, message: string): void {
  console.log(`${COLORS[level]}[${level.toUpperCase()}]${RESET} ${message}`);
}

export const logger = {
  debug: (msg: string) => log("debug", msg),
  info: (msg: string) => log("info", msg),
  warn: (msg: string) => log("warn", msg),
  error: (msg: string) => log("error", msg),
};
