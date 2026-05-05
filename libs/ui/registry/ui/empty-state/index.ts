import {
  EmptyState as EmptyStateRoot,
  emptyStateVariants,
  type EmptyStateProps,
} from "./empty-state";
import { EmptyStateIcon } from "./empty-state-icon";
import { EmptyStateMessage } from "./empty-state-message";
import { EmptyStateDescription } from "./empty-state-description";
import { EmptyStateActions } from "./empty-state-actions";

const EmptyState = Object.assign(EmptyStateRoot, {
  Icon: EmptyStateIcon,
  Message: EmptyStateMessage,
  Description: EmptyStateDescription,
  Actions: EmptyStateActions,
});

export { EmptyState, emptyStateVariants, type EmptyStateProps };
export { EmptyStateIcon, type EmptyStateIconProps } from "./empty-state-icon";
export { EmptyStateMessage, type EmptyStateMessageProps } from "./empty-state-message";
export { EmptyStateDescription, type EmptyStateDescriptionProps } from "./empty-state-description";
export { EmptyStateActions, type EmptyStateActionsProps } from "./empty-state-actions";
export { type EmptyStateVariant, type EmptyStateSize } from "./empty-state";
