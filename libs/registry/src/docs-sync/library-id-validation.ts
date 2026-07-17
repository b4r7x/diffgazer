const SAFE_LIBRARY_ID_RE = /^[a-z0-9][a-z0-9-]*$/i;

export function assertSafeLibraryId(id: string, label: string): void {
  if (SAFE_LIBRARY_ID_RE.test(id)) return;
  throw new Error(`${label} must be a safe library id`);
}
