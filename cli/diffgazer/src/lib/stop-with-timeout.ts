export async function stopWithTimeout(stop: () => Promise<void>, timeoutMs: number): Promise<void> {
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeoutMs);
  });
  await Promise.race([stop(), timeout]);
}
