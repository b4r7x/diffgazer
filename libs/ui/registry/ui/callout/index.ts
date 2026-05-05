import { Callout as CalloutRoot, calloutVariants, type CalloutProps } from "./callout";
import { CalloutIcon, type CalloutIconProps } from "./callout-icon";
import { CalloutTitle, type CalloutTitleProps } from "./callout-title";
import { CalloutContent, type CalloutContentProps } from "./callout-content";
import { CalloutDismiss, type CalloutDismissProps } from "./callout-dismiss";

const Callout = Object.assign(CalloutRoot, {
  Icon: CalloutIcon,
  Title: CalloutTitle,
  Content: CalloutContent,
  Dismiss: CalloutDismiss,
});

export { Callout, type CalloutProps };
export { calloutVariants };
export { type CalloutVariant } from "./callout-context";
export { CalloutIcon, type CalloutIconProps };
export { CalloutTitle, type CalloutTitleProps };
export { CalloutContent, type CalloutContentProps };
export { CalloutDismiss, type CalloutDismissProps };
