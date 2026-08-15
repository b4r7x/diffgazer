import * as clack from "@clack/prompts";
import figlet from "figlet";
import bigFont from "figlet/importable-fonts/Big.js";
import pc from "picocolors";
import { sanitizeTerminalText } from "./sanitize-terminal.js";

export class CancelError extends Error {
  constructor() {
    super("Cancelled.");
    this.name = "CancelError";
  }
}

let isSilent = false;
let bigFontLoaded = false;

export function setSilent(value: boolean): void {
  isSilent = value;
}

export function showBanner(name: string): void {
  if (isSilent) return;
  if (!bigFontLoaded) {
    figlet.parseFont("Big", bigFont);
    bigFontLoaded = true;
  }
  const banner = figlet.textSync(name, { font: "Big" });
  console.log(pc.dim(banner));
  console.log();
}

export function info(msg: string): void {
  if (isSilent) return;
  console.log(`  ${sanitizeTerminalText(msg)}`);
}

export function success(msg: string): void {
  if (isSilent) return;
  console.log(`  ${pc.green(sanitizeTerminalText(msg))}`);
}

export function warn(msg: string): void {
  if (isSilent) return;
  console.warn(`  ${pc.yellow(sanitizeTerminalText(msg))}`);
}

export function error(msg: string): void {
  console.error(`  ${pc.red(sanitizeTerminalText(msg))}`);
}

function formatNestedError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const MAX_CAUSE_DEPTH = 8;

// The last-resort printer must not fail while reporting a failure, so a cause
// chain that loops back on itself or runs very deep is truncated instead.
function formatCause(cause: unknown, indent = 1, seen = new WeakSet<Error>()): string {
  const prefix = "  ".repeat(indent);
  if (cause instanceof Error) {
    if (indent > MAX_CAUSE_DEPTH || seen.has(cause)) return `${prefix}... (causes truncated)`;
    seen.add(cause);
  }
  if (cause instanceof AggregateError) {
    const lines = cause.message ? [`${prefix}${cause.message}`] : [];
    for (const inner of cause.errors) {
      lines.push(`${prefix}  - ${formatNestedError(inner)}`);
    }
    if (cause.cause !== undefined) {
      lines.push(formatCause(cause.cause, indent + 1, seen));
    }
    return lines.join("\n");
  }
  if (cause instanceof Error) {
    const lines = [`${prefix}${cause.message}`];
    if (cause.cause !== undefined) {
      lines.push(formatCause(cause.cause, indent + 1, seen));
    }
    return lines.join("\n");
  }
  return `${prefix}${String(cause)}`;
}

export function toErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return sanitizeTerminalText(String(e));

  const lines = [e.message];
  if (e instanceof AggregateError) {
    for (const inner of e.errors) {
      lines.push(`  - ${formatNestedError(inner)}`);
    }
  }
  if (e.cause !== undefined) {
    lines.push(formatCause(e.cause));
  }
  return sanitizeTerminalText(lines.join("\n"));
}

export function fileAction(action: string, filePath: string): void {
  if (isSilent) return;
  console.log(`  ${action} ${sanitizeTerminalText(filePath)}`);
}

export function heading(msg: string): void {
  if (isSilent) return;
  console.log();
  console.log(`  ${pc.bold(sanitizeTerminalText(msg))}`);
}

function canPrompt(): boolean {
  return !isSilent && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

export async function promptConfirm(message: string, initialValue = true): Promise<boolean> {
  if (!canPrompt()) {
    throw new Error(
      `${message} This action needs confirmation, but the terminal is non-interactive. ` +
        "Re-run with --yes to proceed without prompting, or run in an interactive terminal.",
    );
  }

  const result = await clack.confirm({ message, initialValue });
  if (clack.isCancel(result)) {
    throw new CancelError();
  }
  return result;
}

export async function promptSelect(
  message: string,
  options: { value: string; label: string; hint?: string }[],
  flagGuidance = "Pass the choice explicitly with the matching flag, or run in an interactive terminal.",
): Promise<string> {
  if (!canPrompt()) {
    throw new Error(
      `${message} This action needs a selection, but the terminal is non-interactive. ${flagGuidance}`,
    );
  }

  const result = await clack.select({ message, options });
  if (clack.isCancel(result)) {
    throw new CancelError();
  }
  return result;
}

export function newline(): void {
  if (!isSilent) console.log();
}

export function isSilentMode(): boolean {
  return isSilent;
}
