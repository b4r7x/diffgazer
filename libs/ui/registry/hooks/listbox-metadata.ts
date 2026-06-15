/** Metadata for a listbox item when DOM children are not the source of truth. */
export interface ListboxMetadataItem<TId extends string = string> {
  /** Logical item ID used by selection, highlight, and callbacks. */
  id: TId;
  /** True when keyboard navigation should skip the item for listbox roles. */
  disabled?: boolean;
}

/** Returns true when the metadata contains the id and it is not disabled. */
export function hasEnabledMetadataItem<TId extends string>(
  items: ListboxMetadataItem<TId>[],
  id: TId | null,
): id is TId {
  return id !== null && items.some((item) => item.id === id && !item.disabled);
}

/** Returns true when the metadata contains the id regardless of disabled state. */
export function hasMetadataItem<TId extends string>(
  items: ListboxMetadataItem<TId>[],
  id: TId | null,
): id is TId {
  return id !== null && items.some((item) => item.id === id);
}
