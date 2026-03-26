import { useSyncExternalStore } from "react";
import {
  getBreakpointTierFromPx,
  buildResponsiveResult,
  BREAKPOINTS,
  type BreakpointTier,
  type ResponsiveResult,
} from "@diffgazer/core";

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

export function useViewportBreakpoint(): ResponsiveResult {
  const tier = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return buildResponsiveResult(tier);
}
