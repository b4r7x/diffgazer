import type { ProviderInfo } from "@repo/schemas/config";

export type DisplayStatus = 'configured' | 'needs-key' | 'active';

export interface ProviderWithStatus extends ProviderInfo {
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
  displayStatus: DisplayStatus;
}
