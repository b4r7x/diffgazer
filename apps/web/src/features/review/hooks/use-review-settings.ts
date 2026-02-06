import { useSettings } from '@/hooks/use-settings';
import { LensIdSchema, type LensId } from '@stargazer/schemas/review';

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

export function useReviewSettings() {
  const { settings, isLoading } = useSettings();

  const parsedLenses = settings?.defaultLenses?.filter(
    (lens): lens is LensId => LensIdSchema.safeParse(lens).success
  ) ?? [];
  const defaultLenses: LensId[] = parsedLenses.length > 0 ? parsedLenses : FALLBACK_LENSES;

  return { settings, loading: isLoading, defaultLenses };
}
