const DIAGNOSTIC_TAIL_BYTES = 16 * 1024;
const READINESS_LINE_TAIL_BYTES = 16 * 1024;

interface ProcessErrorLike {
  killed?: boolean;
  stderr?: unknown;
  shortMessage?: unknown;
  message?: unknown;
}

export function appendDiagnosticTail(current: Buffer, chunk: Buffer): Buffer {
  if (chunk.length >= DIAGNOSTIC_TAIL_BYTES) {
    return chunk.subarray(chunk.length - DIAGNOSTIC_TAIL_BYTES);
  }

  const overflow = current.length + chunk.length - DIAGNOSTIC_TAIL_BYTES;
  const retained = overflow > 0 ? current.subarray(overflow) : current;
  return Buffer.concat([retained, chunk]);
}

export function consumeCompleteLines(
  tail: Buffer,
  chunk: Buffer,
): { lines: string[]; tail: Buffer } {
  const combined = tail.length === 0 ? chunk : Buffer.concat([tail, chunk]);
  const lines: string[] = [];
  let lineStart = 0;
  let newline = combined.indexOf(0x0a, lineStart);

  while (newline !== -1) {
    const lineEnd = newline > lineStart && combined[newline - 1] === 0x0d ? newline - 1 : newline;
    lines.push(combined.subarray(lineStart, lineEnd).toString());
    lineStart = newline + 1;
    newline = combined.indexOf(0x0a, lineStart);
  }

  const incomplete = combined.subarray(lineStart);
  return {
    lines,
    tail:
      incomplete.length > READINESS_LINE_TAIL_BYTES
        ? incomplete.subarray(incomplete.length - READINESS_LINE_TAIL_BYTES)
        : Buffer.from(incomplete),
  };
}

export function isProcessErrorLike(error: unknown): error is ProcessErrorLike {
  return error !== null && typeof error === "object";
}

function formatProcessError(error: unknown): string {
  if (!isProcessErrorLike(error)) return String(error);

  if (typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim();
  }

  if (typeof error.shortMessage === "string" && error.shortMessage.trim()) {
    return error.shortMessage.trim();
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
}

export function formatProcessFailure(
  error: unknown,
  stderrTail: Buffer,
  stdoutTail: Buffer,
): string {
  const stderr = stderrTail.toString().trim();
  if (stderr) return stderr;

  const stdout = stdoutTail.toString().trim();
  return stdout || formatProcessError(error);
}
