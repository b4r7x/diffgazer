import {
  type EmptyStateProps,
  EmptyState as EmptyStateRoot,
  emptyStateVariants,
} from "./empty-state";
import { EmptyStateActions } from "./empty-state-actions";
import { EmptyStateDescription } from "./empty-state-description";
import { EmptyStateIcon } from "./empty-state-icon";
import { EmptyStateMessage } from "./empty-state-message";

/** Root wrapper - provides size context to all parts. Variant controls root layout only. */
const EmptyState = Object.assign(EmptyStateRoot, {
  Icon: EmptyStateIcon,
  Message: EmptyStateMessage,
  Description: EmptyStateDescription,
  Actions: EmptyStateActions,
});

export { EmptyState, emptyStateVariants, type EmptyStateProps };
export type { EmptyStateSize, EmptyStateVariant } from "./empty-state";
export { EmptyStateActions, type EmptyStateActionsProps } from "./empty-state-actions";
export { EmptyStateDescription, type EmptyStateDescriptionProps } from "./empty-state-description";
export { EmptyStateIcon, type EmptyStateIconProps } from "./empty-state-icon";
export { EmptyStateMessage, type EmptyStateMessageProps } from "./empty-state-message";
