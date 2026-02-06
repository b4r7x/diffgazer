import { useConfigData, useConfigActions } from "@/app/providers/config-provider";

export function useConfig() {
  const data = useConfigData();
  const actions = useConfigActions();

  return {
    ...data,
    ...actions,
  };
}
