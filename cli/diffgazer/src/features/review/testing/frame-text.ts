// biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal color codes
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
const PANEL_BORDER_PATTERN = /[│─┌┐└┘]/g;

/** Drops colour codes while keeping the frame's rows and column padding intact. */
export function stripAnsi(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_PATTERN, "");
}

/** Flattens a rendered frame to plain prose so copy assertions survive panel borders and wrapping. */
export function frameText(frame: string | undefined): string {
  return stripAnsi(frame).replace(PANEL_BORDER_PATTERN, " ").replace(/\s+/g, " ").trim();
}
