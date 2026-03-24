import type { ReactElement } from "react";
import { useNavigation } from "../navigation-context.js";
import { useScope } from "../../hooks/use-scope.js";
import { usePageFooter } from "../../hooks/use-page-footer.js";
import { useBackHandler } from "../../hooks/use-back-handler.js";
import { ReviewContainer } from "../../features/review/components/review-container.js";
import { REVIEW_SHORTCUTS } from "../../config/navigation.js";

export function ReviewScreen(): ReactElement {
  const { route } = useNavigation();

  useScope("review");
  usePageFooter({ shortcuts: REVIEW_SHORTCUTS });
  useBackHandler();

  const mode = route.screen === "review" ? route.mode : undefined;
  const reviewId = route.screen === "review" ? route.reviewId : undefined;

  return <ReviewContainer mode={mode} reviewId={reviewId} />;
}
