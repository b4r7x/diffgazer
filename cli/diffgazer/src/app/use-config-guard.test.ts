/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NavigationProvider, useNavigation } from "../hooks/use-navigation";

const useConfigCheckMock = vi.hoisted(() => vi.fn());

// Boundary mock: network - core api hooks wrap fetch-backed API calls.
vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigCheck: useConfigCheckMock,
}));

import { useConfigGuard } from "./use-config-guard";

describe("useConfigGuard", () => {
  beforeEach(() => {
    useConfigCheckMock.mockReset();
  });

  test("returns api-error instead of redirecting when the config check fails", () => {
    useConfigCheckMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network down"),
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.state).toBe("api-error");
    expect(result.current.route.screen).toBe("home");
  });

  test("redirects to onboarding only when the API reports not configured", async () => {
    useConfigCheckMock.mockReturnValue({
      data: { configured: false },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.state).toBe("not-configured");
    await waitFor(() => {
      expect(result.current.route.screen).toBe("onboarding");
    });
  });
});

function TestNavigationProvider({ children }: { children: ReactNode }) {
  return createElement(NavigationProvider, { initialRoute: { screen: "home" }, children });
}

function useGuardAndRoute() {
  const state = useConfigGuard();
  const { route } = useNavigation();
  return { state, route };
}
