import type {
  TrustCapabilities,
  TrustConfig,
} from "@diffgazer/core/schemas/config";
import { normalizeTrustCapabilities } from "@diffgazer/core/schemas/config";

export interface TrustDraft {
  editorKey: string;
  capabilities: TrustCapabilities;
}

export interface TrustEditorInput {
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
}

export interface TrustEditorView {
  editorKey: string;
  capabilities: TrustCapabilities;
  isTrusted: boolean;
}

export function getTrustEditorKey({
  projectId,
  repoRoot,
  trust,
}: TrustEditorInput): string {
  if (trust) return `${trust.projectId}:${trust.trustedAt}`;
  return `${projectId ?? "loading"}:${repoRoot ?? "loading"}:untrusted`;
}

export function getInitialDraft(input: TrustEditorInput): TrustDraft {
  return {
    editorKey: getTrustEditorKey(input),
    capabilities: normalizeTrustCapabilities(input.trust?.capabilities),
  };
}

export function resolveEditorView(
  draft: TrustDraft,
  input: TrustEditorInput,
): TrustEditorView {
  const editorKey = getTrustEditorKey(input);
  const isTrusted = Boolean(input.trust?.capabilities.readFiles);
  if (draft.editorKey === editorKey) {
    return { editorKey, capabilities: draft.capabilities, isTrusted };
  }
  return {
    editorKey,
    capabilities: normalizeTrustCapabilities(input.trust?.capabilities),
    isTrusted,
  };
}

export interface SavePayloadInput {
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  capabilities: TrustCapabilities;
  now: () => Date;
}

export type SavePayloadResult =
  | { kind: "ready"; payload: TrustConfig }
  | { kind: "blocked"; reason: "project-missing" };

export function buildSavePayload({
  projectId,
  repoRoot,
  trust,
  capabilities,
  now,
}: SavePayloadInput): SavePayloadResult {
  if (!projectId || !repoRoot) return { kind: "blocked", reason: "project-missing" };
  return {
    kind: "ready",
    payload: {
      projectId,
      repoRoot,
      capabilities,
      trustMode: trust?.trustMode ?? "persistent",
      trustedAt: now().toISOString(),
    },
  };
}
