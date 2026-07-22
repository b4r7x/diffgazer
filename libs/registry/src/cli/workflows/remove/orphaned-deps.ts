export function findOrphanedNpmDeps<TItem>(opts: {
  removedNames: string[];
  getAllItems: () => TItem[];
  getItemName: (item: TItem) => string;
  getItemDeps: (item: TItem) => string[];
  isInstalled: (item: TItem) => boolean;
}): string[] {
  const allItems = opts.getAllItems();
  const removedSet = new Set(opts.removedNames);
  const removedDeps = new Set(
    opts.removedNames.flatMap((n) => {
      const item = allItems.find((i) => opts.getItemName(i) === n);
      return item ? opts.getItemDeps(item) : [];
    }),
  );
  if (removedDeps.size === 0) return [];

  const remainingDeps = new Set(
    allItems
      .filter((i) => !removedSet.has(opts.getItemName(i)) && opts.isInstalled(i))
      .flatMap((i) => opts.getItemDeps(i)),
  );
  return [...removedDeps].filter((d) => !remainingDeps.has(d));
}
