export type TimerFormat = "short" | "long";

/**
 * Format elapsed milliseconds as mm:ss (short) or hh:mm:ss (long).
 */
export function formatTime(ms: number, format: TimerFormat = "short"): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (format === "long") {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format a Date or string timestamp as hh:mm:ss.
 */
export function formatTimestamp(timestamp: Date | string): string {
  if (typeof timestamp === "string") return timestamp;
  const hours = timestamp.getHours().toString().padStart(2, "0");
  const minutes = timestamp.getMinutes().toString().padStart(2, "0");
  const seconds = timestamp.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}
