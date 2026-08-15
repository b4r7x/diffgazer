import { useConfigurationInit } from "@diffgazer/core/api/hooks";
import { resolveSelectedConfiguration } from "@diffgazer/core/schemas/config";
import { useEffect, useEffectEvent } from "react";
import { useNavigation } from "../hooks/use-navigation";

type ConfigGuardState = "checking" | "configured" | "not-configured" | "api-error";

interface ConfigGuard {
  status: ConfigGuardState;
  error: Error | null;
  retry: () => void;
}

function resolveStatus(
  isLoading: boolean,
  error: Error | null,
  configured: boolean,
): ConfigGuardState {
  if (isLoading) return "checking";
  if (error) return "api-error";
  return configured ? "configured" : "not-configured";
}

export function useConfigGuard(): ConfigGuard {
  const { data, isLoading, error, refetch } = useConfigurationInit();
  const configured = data ? resolveSelectedConfiguration(data) !== null : false;
  const { navigate, route } = useNavigation();

  const redirectIfMissing = useEffectEvent(() => {
    if (route.screen === "onboarding") return;
    navigate({ screen: "onboarding" });
  });

  useEffect(() => {
    if (isLoading || error) return;
    if (!configured) {
      redirectIfMissing();
    }
  }, [isLoading, error, configured]);

  return {
    status: resolveStatus(isLoading, error, configured),
    error,
    retry: () => {
      void refetch();
    },
  };
}
