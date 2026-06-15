import { deriveSaveState } from "@diffgazer/core/forms";
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
  return deriveSaveState({ persisted, choice, saving, fallback: DEFAULT_STORAGE });
}
