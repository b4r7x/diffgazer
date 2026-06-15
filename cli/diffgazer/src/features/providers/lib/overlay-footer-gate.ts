/**
 * The ApiKeyOverlay footer ←/→ navigation must be inactive while the key input
 * is focused, otherwise → then Enter while typing activates Cancel and discards
 * the typed key (F-347b — Ink delivers keystrokes to all active subscribers).
 */
export function isOverlayFooterNavActive({
  open,
  saving,
  inputFocused,
}: {
  open: boolean;
  saving: boolean;
  inputFocused: boolean;
}): boolean {
  return open && !saving && !inputFocused;
}
