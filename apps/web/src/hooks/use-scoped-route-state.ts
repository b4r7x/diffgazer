import { useRouteState } from '@repo/hooks';
import { useLocation } from '@tanstack/react-router';

export function useScopedRouteState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const { pathname } = useLocation();
  return useRouteState(key, defaultValue, { scope: pathname });
}
