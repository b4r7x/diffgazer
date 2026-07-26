"use client";

import type { ReactNode } from "react";
import { OverlayHints } from "../shared/overlay-hints";

/** Props for command palette footer. */
export interface CommandPaletteFooterProps {
  /**
   * Footer content. Omit it to render the palette's canonical keyboard legend
   * (Navigate / Select / Close) through the shared OverlayHints primitive.
   */
  children?: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Hint bar / status area. */
export function CommandPaletteFooter({ children, className }: CommandPaletteFooterProps) {
  return (
    <div data-slot="command-palette-footer" className={className}>
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
