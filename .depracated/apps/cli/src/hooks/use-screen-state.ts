import { useRouteState } from '@repo/hooks';
import { useCurrentView } from '../features/app/context/current-view-context.js';

type SetState<T> = (value: T | ((prev: T) => T)) => void;

/**
 * Screen-scoped state management for CLI views.
 * Automatically scopes state keys to the current screen to prevent
 * cross-screen state pollution.
 *
 * @param key - The state key (scoped per screen)
 * @param defaultValue - Default value if state doesn't exist, or a function that returns it
 * @returns Tuple of [value, setter]
 *
 * @example
 * const [expandedItems, setExpanded] = useScreenState<string[]>('expanded', []);
 * const [item, setItem] = useScreenState('item', () => computeDefault());
 */
export function useScreenState<T>(
  key: string,
  defaultValue: T | (() => T)
): [T, SetState<T>] {
  const currentView = useCurrentView();
  const scopedKey = `${currentView}:${key}`;

  // Resolve function-based defaults to actual values
  const resolvedDefault = typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;

  return useRouteState(scopedKey, resolvedDefault);
}
