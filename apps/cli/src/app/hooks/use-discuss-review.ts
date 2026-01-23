import { useCallback, useRef } from "react";
import { getErrorMessage } from "@repo/core";
import { api } from "../../lib/api.js";

interface ReviewData {
  metadata: {
    id: string;
    sessionId: string | null;
    criticalCount: number;
    warningCount: number;
  };
  result: {
    summary: string;
    issues: unknown[];
  };
}

interface SessionActions {
  createSession: (title?: string) => Promise<{ metadata: { id: string } } | null>;
}

interface ReviewHistoryActions {
  currentReview: ReviewData | null;
  reset: () => void;
}

interface UseDiscussReviewOptions {
  session: SessionActions;
  reviewHistory: ReviewHistoryActions;
}

/**
 * Hook that handles starting a chat discussion about a code review.
 * Creates a new session, links it to the review, and sets up context.
 */
export function useDiscussReview({ session, reviewHistory }: UseDiscussReviewOptions) {
  const navigateToChatRef = useRef<(() => void) | null>(null);

  const handleDiscussReview = useCallback(async () => {
    const currentReview = reviewHistory.currentReview;
    if (!currentReview || currentReview.metadata.sessionId !== null) return;

    const title = `Discussion: Review ${currentReview.metadata.id.slice(0, 8)}`;
    const newSession = await session.createSession(title);

    if (!newSession) return;

    try {
      await api().request("PATCH", `/reviews/${currentReview.metadata.id}`, {
        body: { sessionId: newSession.metadata.id },
      });
    } catch (e) {
      console.warn("Failed to link review to session:", getErrorMessage(e));
    }

    const systemMessage =
      `This session was started to discuss a code review.\n\n` +
      `Review Summary: ${currentReview.result.summary}\n\n` +
      `Issues Found: ${currentReview.result.issues.length}\n` +
      `Critical: ${currentReview.metadata.criticalCount}\n` +
      `Warnings: ${currentReview.metadata.warningCount}\n\n` +
      `You can ask questions about the review findings.`;

    try {
      await api().post(`/sessions/${newSession.metadata.id}/messages`, {
        role: "system",
        content: systemMessage,
      });
    } catch (e) {
      console.warn("Failed to add system message:", getErrorMessage(e));
    }

    reviewHistory.reset();
    navigateToChatRef.current?.();
  }, [session, reviewHistory]);

  const setNavigateToChat = useCallback((fn: () => void) => {
    navigateToChatRef.current = fn;
  }, []);

  return {
    handleDiscussReview,
    setNavigateToChat,
  };
}
