import type { ProviderInfo } from '@stargazer/schemas/config';

export type DisplayStatus = 'active' | 'configured' | 'needs-key';

export interface ProviderWithStatus extends ProviderInfo {
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
  displayStatus: DisplayStatus;
}
