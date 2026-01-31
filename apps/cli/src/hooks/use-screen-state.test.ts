import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreenState } from './use-screen-state.js';
import * as routeStateModule from '@repo/hooks';

vi.mock('../features/app/context/current-view-context', () => ({
  useCurrentView: vi.fn(() => 'test-view'),
}));

describe('useScreenState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeStateModule.clearRouteState();
  });

  it('should return initial default value', () => {
    const { result } = renderHook(() => useScreenState('count', 0));
    const [value] = result.current;
    expect(value).toBe(0);
  });

  it('should update state with setter function', () => {
    const { result } = renderHook(() => useScreenState('count', 0));

    act(() => {
      const [, setState] = result.current;
      setState(42);
    });

    const [value] = result.current;
    expect(value).toBe(42);
  });

  it('should scope key by current view', () => {
    const { result } = renderHook(() => useScreenState('item', 'initial'));

    const storeSize = routeStateModule.getRouteStateSize();

    act(() => {
      const [, setState] = result.current;
      setState('updated');
    });

    expect(routeStateModule.getRouteStateSize()).toBe(storeSize);
  });

  it('should support updater function', () => {
    const { result } = renderHook(() => useScreenState<number>('count', 5));

    act(() => {
      const [, setState] = result.current;
      setState((prev: number) => prev + 10);
    });

    const [value] = result.current;
    expect(value).toBe(15);
  });

  it('should maintain state across hook invocations with same key', () => {
    const { result: result1 } = renderHook(() => useScreenState('shared', 'value1'));

    act(() => {
      const [, setState] = result1.current;
      setState('updated');
    });

    const { result: result2 } = renderHook(() => useScreenState('shared', 'default'));
    const [value] = result2.current;
    expect(value).toBe('updated');
  });
});
