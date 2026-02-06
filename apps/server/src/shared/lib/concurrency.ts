export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve) => {
    const launchNext = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }

      while (active < limit && nextIndex < items.length) {
        const currentIndex = nextIndex++;
        active++;
        Promise.resolve(worker(items[currentIndex]!, currentIndex))
          .then((value) => {
            results[currentIndex] = { status: "fulfilled", value };
          })
          .catch((reason) => {
            results[currentIndex] = { status: "rejected", reason };
          })
          .finally(() => {
            active--;
            launchNext();
          });
      }
    };

    launchNext();
  });
}
