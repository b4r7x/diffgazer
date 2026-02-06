import { useMemo } from 'react';
import { useSettings } from '@/hooks/use-settings';
import { LensIdSchema, type LensId } from '@stargazer/schemas/review';

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

export function useReviewSettings() {
  const { settings, isLoading } = useSettings();

  const defaultLenses = useMemo(() => {
    const parsed = settings?.defaultLenses?.filter(
      (lens): lens is LensId => LensIdSchema.safeParse(lens).success
    ) ?? [];
    return parsed.length > 0 ? parsed : FALLBACK_LENSES;
  }, [settings?.defaultLenses]);

  return { settings, loading: isLoading, defaultLenses };
}
