import { useSettings } from "@diffgazer/core/api/hooks";
import { toSelectableTheme } from "@diffgazer/core/schemas/config";
import { useEffect, useRef } from "react";
import { useTheme } from "../theme/provider";

/**
 * Applies the persisted theme once, on first load. An explicit `--theme` flag
 * wins outright, and a later theme change from the settings screen must not be
 * clobbered by a refetch, hence the one-shot ref.
 */
export function StartupThemeSync({ explicitTheme }: { explicitTheme?: string }): null {
  const settingsQuery = useSettings();
  const { setTheme } = useTheme();
  const hasApplied = useRef(false);

  useEffect(() => {
    if (explicitTheme || hasApplied.current || !settingsQuery.data?.theme) return;
    hasApplied.current = true;
    setTheme(toSelectableTheme(settingsQuery.data.theme));
  }, [explicitTheme, settingsQuery.data?.theme, setTheme]);

  return null;
}
