type TimerFormat = "short" | "long";

const DATE_LABEL_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getLocalDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(ms: number, format: TimerFormat = "short"): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60);
  const clockMinutes = minutes % 60;
  const seconds = totalSeconds % 60;

  if (format === "long") {
    return `${hours.toString().padStart(2, "0")}:${clockMinutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime()))
    return typeof timestamp === "string" ? timestamp : "Invalid Date";
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function getDateKey(dateStr: string): string {
  if (DATE_KEY_PATTERN.test(dateStr)) return dateStr;
  return getLocalDateKey(new Date(dateStr));
}

function formatDateKeyLabel(dateKey: string, options?: { showYear?: boolean }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "Invalid Date";

  const [, year, monthText, dayText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const monthLabel = DATE_LABEL_MONTHS[month - 1];
  if (!monthLabel || day < 1 || day > 31) return "Invalid Date";

  const label = `${monthLabel} ${day}`;
  return options?.showYear ? `${label}, ${year}` : label;
}

export function getDateLabel(dateStr: string, options?: { showYear?: boolean }): string {
  const dateKey = getDateKey(dateStr);
  const now = new Date();
  const today = getLocalDateKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = getLocalDateKey(yesterdayDate);

  if (dateKey === today) return "Today";
  if (dateKey === yesterday) return "Yesterday";

  return formatDateKeyLabel(dateKey, options);
}

export function getTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs == null) return "--";
  const seconds = Math.floor(durationMs / 1000);
  if (seconds === 0) return `${durationMs}ms`;
  if (seconds < 60) return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function formatTimestampOrNA(value: string | null | undefined, fallback = "N/A"): string {
  return value ? new Date(value).toLocaleString() : fallback;
}
