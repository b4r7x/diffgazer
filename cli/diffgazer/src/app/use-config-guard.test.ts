/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const useConfigCheckMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@diffgazer/core/api/hooks", () => ({
  useConfigCheck: useConfigCheckMock,
}));

vi.mock("../hooks/use-navigation", () => ({
  useNavigation: () => ({
    navigate: navigateMock,
    route: { screen: "home" },
  }),
}));

import { useConfigGuard } from "./use-config-guard";

describe("useConfigGuard", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useConfigCheckMock.mockReset();
  });

  test("returns api-error instead of redirecting when the config check fails", () => {
    useConfigCheckMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network down"),
    });

    const { result } = renderHook(() => useConfigGuard());

    expect(result.current).toBe("api-error");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  test("redirects to onboarding only when the API reports not configured", () => {
    useConfigCheckMock.mockReturnValue({
      data: { configured: false },
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useConfigGuard());

    expect(result.current).toBe("not-configured");
    expect(navigateMock).toHaveBeenCalledWith({ screen: "onboarding" });
  });
});
