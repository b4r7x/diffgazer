import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";

/**
 * Writes a diagnostic to stderr through the binary's escape sanitizer. Startup
 * failures carry cwd-derived paths, config fragments, and (in `--dev`) verbatim
 * child stderr, so no launcher or server adapter may call `console.*` directly.
 */
export function reportToTerminal(message: string): void {
  console.error(sanitizeTerminalText(message));
}

/** Non-fatal companion to `reportToTerminal`. */
export function warnToTerminal(message: string): void {
  console.warn(sanitizeTerminalText(message));
}

/** Informational companion to `reportToTerminal`. */
export function printToTerminal(message: string): void {
  console.log(sanitizeTerminalText(message));
}
