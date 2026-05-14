export function formatIssueLineRange(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null) return "?";
  if (end == null) return String(start);
  return `${start}-${end}`;
}
