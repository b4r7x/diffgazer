import type { SecretsStorage } from "@diffgazer/core/schemas/config";

export interface StorageSaveInput {
  persisted: SecretsStorage | null;
  choice: SecretsStorage | null;
  saving: boolean;
}

export interface StorageSaveState {
  effective: SecretsStorage;
  isDirty: boolean;
  canSave: boolean;
}

const DEFAULT_STORAGE: SecretsStorage = "file";

export function deriveStorageSaveState({
  persisted,
  choice,
  saving,
}: StorageSaveInput): StorageSaveState {
  const effective = choice ?? persisted ?? DEFAULT_STORAGE;
  const isDirty = persisted !== effective;
  const canSave = !saving && isDirty;
  return { effective, isDirty, canSave };
}
