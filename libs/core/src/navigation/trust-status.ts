import type { TrustConfig } from "../schemas/config/settings.js";

export type TrustStatus = "trusted" | "untrusted" | "unknown";

export interface TrustStatusInput {
  trust: TrustConfig | null | undefined;
  projectId: string | null | undefined;
  repoRoot: string | null | undefined;
}

export interface DerivedTrustStatus {
  /** Project is identified but trust has never been resolved — prompt user. */
  needsTrust: boolean;
  /** Read capability is granted. */
  isTrusted: boolean;
  /** Tri-state for badge rendering. */
  status: TrustStatus;
}

export function deriveTrustStatus(input: TrustStatusInput): DerivedTrustStatus {
  const { trust, projectId, repoRoot } = input;

  const isTrusted = Boolean(trust?.capabilities.readFiles);
  const needsTrust = Boolean(projectId && repoRoot && trust === null);

  const status: TrustStatus = needsTrust ? "untrusted" : isTrusted ? "trusted" : "unknown";

  return { needsTrust, isTrusted, status };
}
