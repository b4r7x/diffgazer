import { useSyncExternalStore } from "react";
import {
  getBreakpointTierFromPx,
  BREAKPOINTS,
  type BreakpointTier,
} from "@diffgazer/core";

type ViewportBreakpoint = {
  tier: BreakpointTier;
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
};

const queries = {
  wide: `(min-width: ${BREAKPOINTS.wide.minPx}px)`,
  medium: `(min-width: ${BREAKPOINTS.medium.minPx}px) and (max-width: ${BREAKPOINTS.medium.maxPx}px)`,
};

function getSnapshot(): BreakpointTier {
  return getBreakpointTierFromPx(window.innerWidth);
}

function getServerSnapshot(): BreakpointTier {
  return "wide";
}

function subscribe(callback: () => void): () => void {
  const wideQuery = window.matchMedia(queries.wide);
  const mediumQuery = window.matchMedia(queries.medium);

  wideQuery.addEventListener("change", callback);
  mediumQuery.addEventListener("change", callback);

  return () => {
    wideQuery.removeEventListener("change", callback);
    mediumQuery.removeEventListener("change", callback);
  };
}

function buildResult(tier: BreakpointTier): ViewportBreakpoint {
  return {
    tier,
    isNarrow: tier === "narrow",
    isMedium: tier === "medium",
    isWide: tier === "wide",
  };
}

export function useViewportBreakpoint(): ViewportBreakpoint {
  const tier = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return buildResult(tier);
}
