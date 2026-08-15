import { useEffect, useState } from "react";
import { type DemoMap, demoLoaders } from "@/generated/demo-loaders";

const EMPTY_DEMOS: DemoMap = {};

interface DemoState {
  libraryId: string;
  demos: DemoMap;
  status: "loading" | "ready" | "error";
  error: Error | null;
}

export interface DemoLoadResult {
  demos: DemoMap;
  isLoading: boolean;
  loadError: Error | null;
  retry: () => void;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function useDemos(libraryId: string): DemoLoadResult {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<DemoState>(() => ({
    libraryId,
    demos: EMPTY_DEMOS,
    status: "loading",
    error: null,
  }));

  const retry = () => {
    setRetryCount((count) => count + 1);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount is the explicit reload signal.
  useEffect(() => {
    let active = true;
    const loader = demoLoaders[libraryId];

    setState({ libraryId, demos: EMPTY_DEMOS, status: "loading", error: null });

    if (!loader) {
      setState({ libraryId, demos: EMPTY_DEMOS, status: "ready", error: null });
      return;
    }

    loader()
      .then((m) => {
        if (active) setState({ libraryId, demos: m.demos, status: "ready", error: null });
      })
      .catch((err) => {
        if (!active) return;
        const error = toError(err);
        // Missing/broken demo bundles must not crash the docs page; surface the
        // failure in the preview chrome while keeping surrounding MDX readable.
        if (import.meta.env.DEV) console.warn("Failed to load demos:", error);
        setState({ libraryId, demos: EMPTY_DEMOS, status: "error", error });
      });

    return () => {
      active = false;
    };
  }, [libraryId, retryCount]);

  if (state.libraryId !== libraryId) {
    return { demos: EMPTY_DEMOS, isLoading: true, loadError: null, retry };
  }

  return {
    demos: state.demos,
    isLoading: state.status === "loading",
    loadError: state.status === "error" ? state.error : null,
    retry,
  };
}
