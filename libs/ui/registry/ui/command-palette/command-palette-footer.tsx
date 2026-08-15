"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { OverlayHints } from "../shared/overlay-hints";

/** Props for command palette footer. */
export interface CommandPaletteFooterProps extends ComponentPropsWithRef<"div"> {
  /**
   * Footer content. Omit it to render the palette's canonical keyboard legend
   * (Navigate / Select / Close) through the shared OverlayHints primitive.
   */
  children?: ReactNode;
}

/** Hint bar / status area. */
export function CommandPaletteFooter({ children, className, ...props }: CommandPaletteFooterProps) {
  return (
    <div {...props} data-slot="command-palette-footer" className={className}>
      {children ?? <DefaultHints />}
    </div>
  );
}

function DefaultHints() {
  return (
    <OverlayHints>
      <OverlayHints.Item keys={["↑", "↓"]} size="sm">
        Navigate
      </OverlayHints.Item>
      <OverlayHints.Item keys={["↵"]} size="sm">
        Select
      </OverlayHints.Item>
      <OverlayHints.Item keys={["Esc"]} size="sm">
        Close
      </OverlayHints.Item>
    </OverlayHints>
  );
}
