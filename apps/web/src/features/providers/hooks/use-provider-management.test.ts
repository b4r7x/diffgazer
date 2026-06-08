import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderManagement } from "./use-provider-management";

const mockSaveApiKey = vi.fn();
const mockRemoveApiKey = vi.fn();
const mockSelectProvider = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("./use-providers", () => ({
  useProviders: () => ({
    providers: [],
    isLoading: false,
    saveApiKey: mockSaveApiKey,
    removeApiKey: mockRemoveApiKey,
    selectProvider: mockSelectProvider,
  }),
}));

vi.mock("@diffgazer/ui/components/toast", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

describe("useProviderManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the API key dialog open when saving credentials fails", async () => {
    mockSaveApiKey.mockRejectedValue(new Error("Save failed"));

    const { result } = renderHook(() => useProviderManagement());

    act(() => {
      result.current.setApiKeyDialogOpen(true);
    });

    await act(async () => {
      await expect(result.current.handleSaveApiKey("gemini", "sk-test")).rejects.toThrow(
        "Save failed",
      );
    });

    expect(result.current.apiKeyDialogOpen).toBe(true);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("rejects activation failures without showing a success toast", async () => {
    mockSelectProvider.mockRejectedValue(new Error("Activation failed"));

    const { result } = renderHook(() => useProviderManagement());

    await act(async () => {
      await expect(
        result.current.handleSelectProvider("gemini", "Gemini", "gemini-2.5-flash"),
      ).rejects.toThrow("Activation failed");
    });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Failed to Activate",
        expect.objectContaining({ message: "Activation failed" }),
      );
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("keeps the model dialog open when model selection fails", async () => {
    mockSelectProvider.mockRejectedValue(new Error("Model save failed"));

    const { result } = renderHook(() => useProviderManagement());

    act(() => {
      result.current.setModelDialogOpen(true);
    });

    await act(async () => {
      await expect(result.current.handleSelectModel("gemini", "gemini-2.5-pro")).rejects.toThrow(
        "Model save failed",
      );
    });

    expect(result.current.modelDialogOpen).toBe(true);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });
});
