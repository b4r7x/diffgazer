import { useConfigCheck } from "@diffgazer/core/api/hooks";
import { useEffect, useEffectEvent } from "react";
import { useNavigation } from "../hooks/use-navigation";

export type ConfigGuardState = "checking" | "configured" | "not-configured" | "api-error";

export function useConfigGuard(): ConfigGuardState {
  const { data, isLoading, error } = useConfigCheck();
  const { navigate, route } = useNavigation();

  const redirectIfMissing = useEffectEvent(() => {
    if (route.screen === "onboarding") return;
    navigate({ screen: "onboarding" });
  });

  useEffect(() => {
    if (isLoading || error) return;
    if (!data?.configured) {
      redirectIfMissing();
    }
  }, [isLoading, error, data?.configured]);

  if (isLoading) return "checking";
  if (error) return "api-error";
  if (data?.configured) return "configured";
  return "not-configured";
}
