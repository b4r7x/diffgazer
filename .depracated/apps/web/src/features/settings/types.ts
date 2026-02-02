import type { TrustCapabilities, TrustMode } from '@repo/schemas';

export interface SaveTrustRequest {
    projectId: string;
    repoRoot: string;
    capabilities: TrustCapabilities;
    trustMode: TrustMode;
    trustedAt: string;
}
