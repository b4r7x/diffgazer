import { deriveSaveState } from "@diffgazer/core/forms";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";

export interface StorageSaveInput {
  persisted: SecretsStorage | null;
  choice: SecretsStorage | null;
  saving: boolean;
}

export interface StorageSaveState {
  effective: SecretsStorage | null;
  isDirty: boolean;
  canSave: boolean;
}

export function deriveStorageSaveState({
  persisted,
  choice,
  saving,
}: StorageSaveInput): StorageSaveState {
  const state = deriveSaveState<SecretsStorage | null>({
    persisted,
    choice,
    saving,
    fallback: null,
  });
  return { ...state, canSave: state.effective !== null && state.canSave };
}
