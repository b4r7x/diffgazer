export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; initialDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, initialDelay = 1000, maxDelay = 10000 } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function timeout<T>(promise: Promise<T>, ms: number, message = "Operation timed out"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
