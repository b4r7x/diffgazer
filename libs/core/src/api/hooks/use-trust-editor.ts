import { useState } from "react";
import { getErrorMessage } from "../../errors.js";
import type {
  TrustCapabilities,
  TrustDraft,
  TrustEditorInput,
} from "../../schemas/config/index.js";
import {
  buildSavePayload,
  getInitialDraft,
  NO_TRUST_CAPABILITIES,
  resolveEditorView,
} from "../../schemas/config/index.js";
import { useDeleteTrust, useSaveTrust } from "./trust.js";

export const TRUST_EDITOR_MESSAGES = {
  blocked: "Project information not available",
  saved: "Trust permissions updated",
  saveFailed: "Failed to save trust settings",
  revoked: "Trust has been revoked for this repository",
  revokeFailed: "Failed to revoke trust",
} as const;

export interface UseTrustEditorCallbacks {
  onSaved: () => void;
  onRevoked: () => void;
  onError: (message: string) => void;
}

export interface UseTrustEditorResult {
  capabilities: TrustCapabilities;
  isTrusted: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isRevoking: boolean;
  handleCapabilitiesChange: (next: TrustCapabilities) => void;
  handleSave: () => void;
  handleRevoke: () => void;
}

export function useTrustEditor(
  editorInput: TrustEditorInput,
  { onSaved, onRevoked, onError }: UseTrustEditorCallbacks,
): UseTrustEditorResult {
  const saveTrust = useSaveTrust();
  const deleteTrust = useDeleteTrust();
  const isLoading = saveTrust.isPending || deleteTrust.isPending;

  const [draft, setDraft] = useState<TrustDraft>(() => getInitialDraft(editorInput));

  // Key-reset: when the editor key changes (trust audit timestamp or project
  // identity), reset the draft during render instead of in an effect.
  const view = resolveEditorView(draft, editorInput);
  if (draft.editorKey !== view.editorKey) {
    setDraft({ editorKey: view.editorKey, capabilities: view.capabilities });
  }

  const handleCapabilitiesChange = (next: TrustCapabilities) => {
    setDraft({ editorKey: view.editorKey, capabilities: next });
  };

  function handleSave() {
    if (isLoading) return;
    const result = buildSavePayload({
      ...editorInput,
      capabilities: view.capabilities,
    });
    if (result.kind === "blocked") {
      onError(TRUST_EDITOR_MESSAGES.blocked);
      return;
    }
    saveTrust.mutate(result.payload, {
      onSuccess: () => onSaved(),
      onError: (error) => onError(getErrorMessage(error, TRUST_EDITOR_MESSAGES.saveFailed)),
    });
  }

  function handleRevoke() {
    if (isLoading || !editorInput.projectId) return;
    deleteTrust.mutate(undefined, {
      onSuccess: () => {
        setDraft({ editorKey: view.editorKey, capabilities: NO_TRUST_CAPABILITIES });
        onRevoked();
      },
      onError: (error) => onError(getErrorMessage(error, TRUST_EDITOR_MESSAGES.revokeFailed)),
    });
  }

  return {
    capabilities: view.capabilities,
    isTrusted: view.isTrusted,
    isLoading,
    isSaving: saveTrust.isPending,
    isRevoking: deleteTrust.isPending,
    handleCapabilitiesChange,
    handleSave,
    handleRevoke,
  };
}
