import type { SaveTrustRequest, TrustCapabilities, TrustConfig } from "./settings.js";
import { hasRepositoryReadAccess, normalizeTrustCapabilities } from "./trust-capabilities.js";

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

function getTrustEditorKey({ projectId, repoRoot, trust }: TrustEditorInput): string {
  const projectKey = `${projectId ?? "loading"}:${repoRoot ?? "loading"}`;
  if (trust) return `${projectKey}:${trust.projectId}:${trust.repoRoot}:${trust.trustedAt}`;
  return `${projectKey}:untrusted`;
}

function getApplicableCapabilities(input: TrustEditorInput): TrustCapabilities {
  const capabilities = hasRepositoryReadAccess(input.trust, input.repoRoot)
    ? input.trust?.capabilities
    : null;
  return normalizeTrustCapabilities(capabilities);
}

export function getInitialDraft(input: TrustEditorInput): TrustDraft {
  return {
    editorKey: getTrustEditorKey(input),
    capabilities: getApplicableCapabilities(input),
  };
}

export function resolveEditorView(draft: TrustDraft, input: TrustEditorInput): TrustEditorView {
  const editorKey = getTrustEditorKey(input);
  const isTrusted = hasRepositoryReadAccess(input.trust, input.repoRoot);
  if (draft.editorKey === editorKey) {
    return { editorKey, capabilities: draft.capabilities, isTrusted };
  }
  return {
    editorKey,
    capabilities: getApplicableCapabilities(input),
    isTrusted,
  };
}

export interface SavePayloadInput {
  projectId: string | null;
  repoRoot: string | null;
  trust: TrustConfig | null;
  capabilities: TrustCapabilities;
}

export type SavePayloadResult =
  | { kind: "ready"; payload: SaveTrustRequest }
  | { kind: "blocked"; reason: "project-missing" };

export function buildSavePayload({
  projectId,
  repoRoot,
  trust,
  capabilities,
}: SavePayloadInput): SavePayloadResult {
  // The UI guard still requires resolved project identity before a save; the
  // server derives projectId/repoRoot/trustedAt from the request itself.
  if (!projectId || !repoRoot) return { kind: "blocked", reason: "project-missing" };
  return {
    kind: "ready",
    payload: {
      capabilities: { readFiles: capabilities.readFiles },
      trustMode: trust?.trustMode ?? "persistent",
    },
  };
}
