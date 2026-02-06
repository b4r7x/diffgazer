import { useState } from "react";
import type { TrustConfig } from "@stargazer/schemas/config";
import { api } from "@/lib/api";
import { useConfigActions } from "@/app/providers/config-provider";

interface UseTrustResult {
  save: (config: TrustConfig) => Promise<void>;
  revoke: () => Promise<void>;
  isLoading: boolean;
}

export function useTrust(projectId: string | null): UseTrustResult {
  const { refresh } = useConfigActions();
  const [isLoading, setIsLoading] = useState(false);

  const runWithLoading = async (action: () => Promise<void>): Promise<void> => {
    setIsLoading(true);
    try {
      await action();
    } finally {
      setIsLoading(false);
    }
  };

  const save = async (config: TrustConfig): Promise<void> => {
    await runWithLoading(async () => {
      await api.saveTrust(config);
      await refresh(true);
    });
  };

  const revoke = async (): Promise<void> => {
    if (!projectId) return;
    await runWithLoading(async () => {
      await api.deleteTrust(projectId);
      await refresh(true);
    });
  };

  return { save, revoke, isLoading };
}
