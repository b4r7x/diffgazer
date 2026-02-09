import { useSettings } from '@/hooks/use-settings';
import { LensIdSchema, type LensId } from '@diffgazer/schemas/review';

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

export function useReviewSettings() {
  const { settings, isLoading } = useSettings();

  const parsed = settings?.defaultLenses?.filter(
    (lens): lens is LensId => LensIdSchema.safeParse(lens).success
  ) ?? [];
  const defaultLenses = parsed.length > 0 ? parsed : FALLBACK_LENSES;

  return { settings, loading: isLoading, defaultLenses };
}
