export function keys(
  hotkeys: readonly string[],
  handler: (event: KeyboardEvent) => void,
): Record<string, (event: KeyboardEvent) => void> {
  return Object.fromEntries(hotkeys.map((key) => [key, handler]));
}
