export function resolveTabTarget(
  isActive: boolean,
  hasSelection: boolean,
  container: HTMLElement | null,
  value: string,
  role: string = "radio",
): boolean {
  if (isActive) return true;
  if (hasSelection) return false;
  if (!container) return true;
  const first = container.querySelector(`[role="${role}"]:not(:disabled):not([aria-disabled="true"])`);
  return first?.getAttribute("data-value") === value;
}
