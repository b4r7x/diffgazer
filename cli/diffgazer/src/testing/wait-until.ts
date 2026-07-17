export interface WaitUntilOptions {
  attempts?: number;
  intervalMs?: number;
}

export async function waitUntil(
  predicate: () => boolean,
  { attempts = 100, intervalMs = 10 }: WaitUntilOptions = {},
): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for condition after ${attempts} attempts`);
}
