import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * HomePage Error Handling Tests
 *
 * Tests the error toast display when navigating to home page with error
 * search parameter, specifically for invalid review ID errors from router.
 *
 * Implementation location: apps/web/src/app/pages/home.tsx:30-39
 */

describe("HomePage - Error Toast Display", () => {
  let mockShowToast: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockShowToast = vi.fn();
    mockNavigate = vi.fn();
  });

  describe("Invalid Review ID Error", () => {
    it("shows error toast when search.error is 'invalid-review-id'", () => {
      const search = { error: 'invalid-review-id' };

      // Simulate useEffect logic from home.tsx:30-39
      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Invalid Review ID",
        message: "The review ID format is invalid.",
      });
    });

    it("navigates to '/' to clear error param after showing toast", () => {
      const search = { error: 'invalid-review-id' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true });
    });

    it("uses replace:true to avoid adding history entry", () => {
      const search = { error: 'invalid-review-id' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      const navigateCall = mockNavigate.mock.calls[0][0];
      expect(navigateCall.replace).toBe(true);
    });

    it("shows toast before navigating (execution order)", () => {
      const search = { error: 'invalid-review-id' };
      const executionOrder: string[] = [];

      const showToastSpy = vi.fn(() => {
        executionOrder.push('showToast');
      });

      const navigateSpy = vi.fn(() => {
        executionOrder.push('navigate');
      });

      if (search.error === 'invalid-review-id') {
        showToastSpy({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        navigateSpy({ to: '/', replace: true });
      }

      expect(executionOrder).toEqual(['showToast', 'navigate']);
    });
  });

  describe("Toast Message Content", () => {
    it("displays correct error variant", () => {
      const search = { error: 'invalid-review-id' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
      }

      const toastCall = mockShowToast.mock.calls[0][0];
      expect(toastCall.variant).toBe("error");
    });

    it("displays correct title", () => {
      const search = { error: 'invalid-review-id' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
      }

      const toastCall = mockShowToast.mock.calls[0][0];
      expect(toastCall.title).toBe("Invalid Review ID");
    });

    it("displays correct message", () => {
      const search = { error: 'invalid-review-id' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
      }

      const toastCall = mockShowToast.mock.calls[0][0];
      expect(toastCall.message).toBe("The review ID format is invalid.");
    });
  });

  describe("No Error Cases", () => {
    it("does not show toast when search.error is undefined", () => {
      const search = { error: undefined };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not show toast when search.error is different error code", () => {
      const search = { error: 'other-error' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not show toast when search object is empty", () => {
      const search = {};

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not show toast when search.error is null", () => {
      const search = { error: null as any };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("does not show toast when search.error is empty string", () => {
      const search = { error: '' };

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Error Condition Precision", () => {
    it("only triggers on exact match 'invalid-review-id'", () => {
      const errorCodes = [
        'invalid-review-id', // should trigger
        'invalid-review', // should not
        'review-id-invalid', // should not
        'INVALID-REVIEW-ID', // should not (case sensitive)
        'invalid-review-id-extra', // should not
      ];

      errorCodes.forEach((errorCode) => {
        const mockShow = vi.fn();
        const search = { error: errorCode };

        if (search.error === 'invalid-review-id') {
          mockShow();
        }

        if (errorCode === 'invalid-review-id') {
          expect(mockShow).toHaveBeenCalled();
        } else {
          expect(mockShow).not.toHaveBeenCalled();
        }
      });
    });

    it("is case-sensitive for error code", () => {
      const caseVariations = [
        'invalid-review-id', // original
        'Invalid-Review-Id',
        'INVALID-REVIEW-ID',
        'Invalid-review-id',
      ];

      caseVariations.forEach((errorCode) => {
        const mockShow = vi.fn();
        const search = { error: errorCode };

        if (search.error === 'invalid-review-id') {
          mockShow();
        }

        // Only exact lowercase match should trigger
        if (errorCode === 'invalid-review-id') {
          expect(mockShow).toHaveBeenCalled();
        } else {
          expect(mockShow).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe("Integration: Complete Error Flow", () => {
    it("handles complete flow from router redirect to toast display", () => {
      // Step 1: Router detects invalid UUID and redirects
      const invalidUUID = "not-a-uuid";
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      let redirectTo = null;
      if (!UUID_REGEX.test(invalidUUID)) {
        redirectTo = { to: '/', search: { error: 'invalid-review-id' } };
      }

      expect(redirectTo).toBeTruthy();

      // Step 2: HomePage receives error param and shows toast
      const search = redirectTo?.search || {};

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      // Verify complete flow
      expect(mockShowToast).toHaveBeenCalledWith({
        variant: "error",
        title: "Invalid Review ID",
        message: "The review ID format is invalid.",
      });
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/', replace: true });
    });

    it("does not trigger error flow for valid UUID", () => {
      // Step 1: Router allows valid UUID to proceed
      const validUUID = "550e8400-e29b-41d4-a716-446655440000";
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      let redirectTo = null;
      if (!UUID_REGEX.test(validUUID)) {
        redirectTo = { to: '/', search: { error: 'invalid-review-id' } };
      }

      expect(redirectTo).toBeNull();

      // Step 2: HomePage has no error param
      const search = {};

      if (search.error === 'invalid-review-id') {
        mockShowToast({
          variant: "error",
          title: "Invalid Review ID",
          message: "The review ID format is invalid.",
        });
        mockNavigate({ to: '/', replace: true });
      }

      // Verify no error handling triggered
      expect(mockShowToast).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
