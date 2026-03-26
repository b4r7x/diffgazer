export type TimerFormat = "short" | "long";

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

export function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (isNaN(date.getTime())) return timestamp as string;
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function formatTimestampLocale(date: Date | string | number): string {
  return new Date(date).toLocaleString();
}

export function getDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

export function getDateLabel(dateStr: string): string {
  const dateKey = getDateKey(dateStr);
  const now = new Date();
  const today = getDateKey(now.toISOString());
  const yesterday = getDateKey(new Date(now.getTime() - 86400000).toISOString());

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (!durationMs) return "--";
  const seconds = Math.floor(durationMs / 1000);
  if (seconds === 0) return `${durationMs}ms`;
  if (seconds < 60) return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function formatTimestampOrNA(
  value: string | null | undefined,
  fallback = "N/A",
): string {
  return value ? formatTimestampLocale(value) : fallback;
}
