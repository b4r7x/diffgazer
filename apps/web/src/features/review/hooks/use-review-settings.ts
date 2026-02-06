import { useEffect, useState } from 'react';
import type { SettingsConfig } from '@stargazer/schemas/config';
import { LensIdSchema, type LensId } from '@stargazer/schemas/review';
import { api } from '@/lib/api';

const FALLBACK_LENSES: LensId[] = ["correctness", "security", "performance", "simplicity", "tests"];

export function useReviewSettings() {
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
      })
      .catch(() => {
        if (!active) return;
        setSettings(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const parsedLenses = settings?.defaultLenses?.filter(
    (lens): lens is LensId => LensIdSchema.safeParse(lens).success
  ) ?? [];
  const defaultLenses: LensId[] = parsedLenses.length > 0 ? parsedLenses : FALLBACK_LENSES;

  return { settings, loading, defaultLenses };
}
