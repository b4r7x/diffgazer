import { useLocation } from "@tanstack/react-router";
import { useRouteState, type SetState } from "./use-route-state";

export function useScopedRouteState<T>(
  key: string,
  defaultValue: T
): [T, SetState<T>] {
  const { pathname } = useLocation();
  return useRouteState(key, defaultValue, { scope: pathname });
}
