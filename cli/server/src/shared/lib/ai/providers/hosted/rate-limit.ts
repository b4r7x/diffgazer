export const RATE_LIMIT_RETRY_DELAYS_MS = [2_000, 8_000] as const;

// Z.AI business codes a 429 body can carry that a retry cannot fix: insufficient
// balance (1113), exhausted 5h/weekly/monthly quotas (1308/1310/1316/1317), and
// fair-usage violations (1313).
const NON_RETRYABLE_RATE_LIMIT_CODES = new Set(["1113", "1308", "1310", "1313", "1316", "1317"]);

export function rateLimitCodeBlocksRetry(bodyText: string): boolean {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    const code =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { error?: { code?: unknown } }).error?.code
        : undefined;
    return (
      (typeof code === "string" || typeof code === "number") &&
      NON_RETRYABLE_RATE_LIMIT_CODES.has(String(code))
    );
  } catch {
    return false;
  }
}

export function rateLimitRetryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds =
    retryAfter === null || retryAfter.trim() === "" ? NaN : Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0 && retryAfterSeconds <= 60) {
    return Math.ceil(retryAfterSeconds * 1000);
  }
  return RATE_LIMIT_RETRY_DELAYS_MS[
    Math.min(attempt, RATE_LIMIT_RETRY_DELAYS_MS.length - 1)
  ] as number;
}

export function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
