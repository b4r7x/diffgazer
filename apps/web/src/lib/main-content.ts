export const MAIN_CONTENT_ID = "main-content";

export function getMainContent(): HTMLElement | null {
  return document.getElementById(MAIN_CONTENT_ID);
}
