/**
 * @vitest-environment jsdom
 */

import { makeReadyInitResponse } from "@diffgazer/core/testing/provider-fixtures";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useNavigation } from "../hooks/use-navigation";
import { NavigationProvider } from "./providers/navigation";
import { useConfigGuard } from "./use-config-guard";

const useConfigurationInitMock = vi.hoisted(() => vi.fn());

vi.mock("@diffgazer/core/api/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diffgazer/core/api/hooks")>();
  return {
    ...actual,
    useConfigurationInit: useConfigurationInitMock,
  };
});

function TestNavigationProvider({ children }: { children: ReactNode }) {
  return <NavigationProvider initialRoute={{ screen: "home" }}>{children}</NavigationProvider>;
}

function useGuardAndRoute() {
  const guard = useConfigGuard();
  const { route } = useNavigation();
  return { guard, route };
}

describe("useConfigGuard", () => {
  beforeEach(() => {
    useConfigurationInitMock.mockReset();
  });

  test("returns api-error instead of redirecting when the config check fails", () => {
    const error = new Error("network down");
    const refetch = vi.fn();
    useConfigurationInitMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
      refetch,
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.guard.status).toBe("api-error");
    expect(result.current.guard.error).toBe(error);
    expect(result.current.route.screen).toBe("home");

    result.current.guard.retry();
    expect(refetch).toHaveBeenCalledOnce();
  });

  test("redirects to onboarding only when no configuration is selected", async () => {
    useConfigurationInitMock.mockReturnValue({
      data: {
        schemaVersion: 2,
        configurations: [],
        selectedConfigurationId: null,
        settings: makeReadyInitResponse().settings,
        project: makeReadyInitResponse().project,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useGuardAndRoute(), { wrapper: TestNavigationProvider });

    expect(result.current.guard.status).toBe("not-configured");
    await waitFor(() => {
      expect(result.current.route.screen).toBe("onboarding");
    });
  });
});
