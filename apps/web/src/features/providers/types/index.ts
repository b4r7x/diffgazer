import type { ProviderInfo } from '@repo/schemas';

export type DisplayStatus = 'active' | 'configured' | 'needs-key';

export interface ProviderWithStatus extends ProviderInfo {
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
  displayStatus: DisplayStatus;
}
