import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useNavigation } from "../app/navigation-context.js";

type ConfigGuardState = "checking" | "configured" | "not-configured";

export function useConfigGuard(): ConfigGuardState {
  const [state, setState] = useState<ConfigGuardState>("checking");
  const { navigate } = useNavigation();

  useEffect(() => {
    const check = async () => {
      try {
        const result = await api.checkConfig();
        if (result.configured) {
          setState("configured");
        } else {
          setState("not-configured");
          navigate({ screen: "onboarding" });
        }
      } catch {
        setState("not-configured");
        navigate({ screen: "onboarding" });
      }
    };
    check();
  }, []);

  return state;
}
