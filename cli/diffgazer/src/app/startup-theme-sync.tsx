import { useConfigurationInit } from "@diffgazer/core/api/hooks";
import { toSelectableTheme } from "@diffgazer/core/schemas/config";
import { useEffect, useRef } from "react";
import type { TuiThemeName } from "../theme/palettes";
import { useTheme } from "../theme/provider";

/**
 * Applies the persisted theme once, on first load. An explicit `--theme` flag
 * wins outright, and a later theme change from the settings screen must not be
 * clobbered by a refetch, hence the one-shot ref.
 */
export function StartupThemeSync({ explicitTheme }: { explicitTheme?: TuiThemeName }): null {
  const initQuery = useConfigurationInit();
  const { setTheme } = useTheme();
  const hasApplied = useRef(false);

  useEffect(() => {
    if (explicitTheme || hasApplied.current || !initQuery.data?.settings.theme) return;
    hasApplied.current = true;
    setTheme(toSelectableTheme(initQuery.data.settings.theme));
  }, [explicitTheme, initQuery.data?.settings.theme, setTheme]);

  return null;
}
