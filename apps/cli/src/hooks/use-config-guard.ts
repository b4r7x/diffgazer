import { useEffect } from "react";
import { useConfigCheck } from "@diffgazer/api/hooks";
import { useNavigation } from "../app/navigation-context.js";

type ConfigGuardState = "checking" | "configured" | "not-configured";

export function useConfigGuard(): ConfigGuardState {
  const { data, isLoading, error } = useConfigCheck();
  const { navigate } = useNavigation();

  useEffect(() => {
    if (isLoading) return;
    if (!data?.configured || error) {
      navigate({ screen: "onboarding" });
    }
  // navigate excluded from deps: fire-and-forget redirect, not reactive
  }, [isLoading, data, error]);

  if (isLoading) return "checking";
  if (data?.configured) return "configured";
  return "not-configured";
}
