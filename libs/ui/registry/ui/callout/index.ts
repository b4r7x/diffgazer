"use client";

import { type CalloutFrame, type CalloutProps, Callout as CalloutRoot } from "./callout";
import { CalloutContent, type CalloutContentProps } from "./callout-content";
import { CalloutDismiss, type CalloutDismissProps } from "./callout-dismiss";
import { CalloutIcon, type CalloutIconProps } from "./callout-icon";
import { CalloutTitle, type CalloutTitleProps } from "./callout-title";

/**
 * Dismissible alert box with tone-driven coloring, frame variants (inline / rail / bar), and a
 * compound API.
 */
const Callout = Object.assign(CalloutRoot, {
  Icon: CalloutIcon,
  Title: CalloutTitle,
  Content: CalloutContent,
  Dismiss: CalloutDismiss,
});

export { Callout, type CalloutProps, type CalloutFrame };
export type { CalloutTone } from "./callout-context";
export { CalloutIcon, type CalloutIconProps };
export { CalloutTitle, type CalloutTitleProps };
export { CalloutContent, type CalloutContentProps };
export { CalloutDismiss, type CalloutDismissProps };
