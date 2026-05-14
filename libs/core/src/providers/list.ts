import type {
  ProviderInfo,
  ProviderStatus,
  ProviderWithStatus,
} from "@diffgazer/core/schemas/config";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";

export function mapProvidersWithStatus(
  statuses: ProviderStatus[],
  providers: readonly ProviderInfo[] = AVAILABLE_PROVIDERS,
): ProviderWithStatus[] {
  return providers.map((provider) => {
    const status = statuses.find((s) => s.provider === provider.id);
    const hasApiKey = status?.hasApiKey ?? false;
    const isActive = status?.isActive ?? false;
    return {
      ...provider,
      hasApiKey,
      isActive,
      model: status?.model,
      displayStatus: isActive ? "active" : hasApiKey ? "configured" : "needs-key",
    };
  });
}
