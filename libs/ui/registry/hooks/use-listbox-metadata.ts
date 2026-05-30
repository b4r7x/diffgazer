export interface ListboxMetadataItem<TId extends string = string> {
  id: TId;
  disabled?: boolean;
}

export function hasEnabledMetadataItem<TId extends string>(
  items: ListboxMetadataItem<TId>[],
  id: TId | null,
): id is TId {
  return id !== null && items.some((item) => item.id === id && !item.disabled);
}

export function hasMetadataItem<TId extends string>(
  items: ListboxMetadataItem<TId>[],
  id: TId | null,
): id is TId {
  return id !== null && items.some((item) => item.id === id);
}
