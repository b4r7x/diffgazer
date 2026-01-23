const MS_PER_MINUTE = 60_000;
const MINS_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const GOOD_SCORE_THRESHOLD = 8;
const WARNING_SCORE_THRESHOLD = 5;

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
  if (diffMins < MINS_PER_HOUR) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / MINS_PER_HOUR);
  if (diffHours < HOURS_PER_DAY) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / HOURS_PER_DAY);
  return `${diffDays}d ago`;
}

export function getScoreColor(score: number | null): string {
  if (score === null) return "gray";
  if (score >= GOOD_SCORE_THRESHOLD) return "green";
  if (score >= WARNING_SCORE_THRESHOLD) return "yellow";
  return "red";
}
