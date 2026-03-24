import { useSettings } from '@diffgazer/api/hooks';
import { resolveDefaultLenses } from '@diffgazer/core/review';

export function useReviewSettings() {
  const { data: settings, isLoading } = useSettings();
  const defaultLenses = resolveDefaultLenses(settings?.defaultLenses);

  return { settings, loading: isLoading, defaultLenses };
}
