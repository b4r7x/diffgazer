import type { TrustConfig } from "../schemas/config/settings.js";
import { hasRepositoryReadAccess } from "../schemas/config/trust-capabilities.js";

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
}

export function deriveTrustStatus(input: TrustStatusInput): DerivedTrustStatus {
  const { trust, projectId, repoRoot } = input;

  const isTrusted = hasRepositoryReadAccess(trust, repoRoot);
  const needsTrust = Boolean(projectId && repoRoot && trust === null);

  return { needsTrust, isTrusted };
}
