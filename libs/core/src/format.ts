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
const MIN_RUN_ID_PREFIX_LENGTH = 8;

function getLocalDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

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

// History maps this over every loaded run on each render. `toLocaleTimeString`
// rebuilds locale machinery per call and dominated that pass; a module-level
// Intl.DateTimeFormat cannot replace it because it pins the timezone at
// construction. The output is fixed en-US 12-hour local time, so derive it from
// the same local getters `formatTimestamp` above uses.
export function getTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

export function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs == null) return "--";
  const seconds = Math.floor(durationMs / 1000);
  if (seconds === 0) return `${durationMs}ms`;
  if (seconds < 60) return `${seconds}.${Math.floor((durationMs % 1000) / 100)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function longestCommonPrefix(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

export type RunIdLookup = ReadonlyMap<string, string>;

export function buildRunIdLookup(peerIds: readonly string[]): RunIdLookup {
  if (peerIds.length === 0) {
    return new Map();
  }

  const normalized = peerIds.map((peerId) => peerId.toLowerCase());
  const sortedIndices = peerIds
    .map((_, index) => index)
    .sort((left, right) => {
      const leftNormalized = normalized[left];
      const rightNormalized = normalized[right];
      if (leftNormalized === undefined || rightNormalized === undefined) {
        return left - right;
      }
      // Code-unit order, not ICU collation: the neighbour scan below assumes an
      // id's longest-common-prefix partner is adjacent once sorted, which holds
      // lexicographically but not under a collation that reweights characters.
      if (leftNormalized === rightNormalized) return left - right;
      return leftNormalized < rightNormalized ? -1 : 1;
    });

  const sortedPosition = new Map<number, number>();
  for (let position = 0; position < sortedIndices.length; position += 1) {
    const indexAtPosition = sortedIndices[position];
    if (indexAtPosition === undefined) {
      continue;
    }
    sortedPosition.set(indexAtPosition, position);
  }

  const lookup = new Map<string, string>();
  for (let index = 0; index < peerIds.length; index += 1) {
    const id = peerIds[index];
    const normalizedId = normalized[index];
    if (id === undefined || normalizedId === undefined) {
      continue;
    }
    const position = sortedPosition.get(index) ?? 0;

    let maxLcp = 0;
    for (const offset of [-1, 1]) {
      const neighborPosition = position + offset;
      if (neighborPosition < 0 || neighborPosition >= sortedIndices.length) {
        continue;
      }
      const neighborIndex = sortedIndices[neighborPosition];
      if (neighborIndex === undefined || neighborIndex === index) {
        continue;
      }
      const neighborNormalized = normalized[neighborIndex];
      if (neighborNormalized === undefined) {
        continue;
      }
      maxLcp = Math.max(maxLcp, longestCommonPrefix(normalizedId, neighborNormalized));
    }

    const minLength = Math.min(MIN_RUN_ID_PREFIX_LENGTH, id.length);
    const length = Math.min(Math.max(minLength, maxLcp + 1), id.length);
    lookup.set(id, `#${id.slice(0, length)}`);
  }

  return lookup;
}

// Standalone label for a run shown on its own. Lists disambiguate against their
// own batch through `buildRunIdLookup`, the single prefix-length authority.
export function formatRunId(id: string): string {
  return `#${id.slice(0, Math.min(MIN_RUN_ID_PREFIX_LENGTH, id.length))}`;
}

export function formatLocaleDateTimeOrFallback(
  value: string | null | undefined,
  fallback = "N/A",
): string {
  return value ? new Date(value).toLocaleString() : fallback;
}
