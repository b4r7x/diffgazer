import { useEffect, useState } from "react";
import { type DemoMap, demoLoaders } from "@/generated/demo-loaders";

export type { DemoMap };

const EMPTY_DEMOS: DemoMap = {};

interface DemoState {
  libraryId: string;
  demos: DemoMap;
  status: "loading" | "ready";
}

export interface DemoLoadResult {
  demos: DemoMap;
  isLoading: boolean;
}

export function useDemos(libraryId: string): DemoLoadResult {
  const [state, setState] = useState<DemoState>(() => ({
    libraryId,
    demos: EMPTY_DEMOS,
    status: "loading",
  }));

  useEffect(() => {
    let active = true;
    const loader = demoLoaders[libraryId];

    if (!loader) {
      setState({ libraryId, demos: EMPTY_DEMOS, status: "ready" });
      return;
    }

    loader()
      .then((m) => {
        if (active) setState({ libraryId, demos: m.demos, status: "ready" });
      })
      .catch((err) => {
        if (!active) return;
        // Missing/broken demo bundles must not crash the docs page; render an
        // invisible fallback so the surrounding MDX content stays readable.
        if (import.meta.env.DEV) console.warn("Failed to load demos:", err);
        setState({ libraryId, demos: EMPTY_DEMOS, status: "ready" });
      });

    return () => {
      active = false;
    };
  }, [libraryId]);

  if (state.libraryId !== libraryId) {
    return { demos: EMPTY_DEMOS, isLoading: true };
  }

  return { demos: state.demos, isLoading: state.status === "loading" };
}
