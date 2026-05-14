import { useEffect, useEffectEvent } from "react";
import { useConfigCheck } from "@diffgazer/core/api/hooks";
import { useNavigation } from "../app/navigation-context.js";

type ConfigGuardState = "checking" | "configured" | "not-configured";

export function useConfigGuard(): ConfigGuardState {
  const { data, isLoading, error } = useConfigCheck();
  const { navigate } = useNavigation();

  const redirectIfMissing = useEffectEvent(() => {
    if (!data?.configured || error) {
      navigate({ screen: "onboarding" });
    }
  });

  useEffect(() => {
    if (isLoading) return;
    redirectIfMissing();
  }, [isLoading, data, error]);

  if (isLoading) return "checking";
  if (data?.configured) return "configured";
  return "not-configured";
}
