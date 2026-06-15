"use client";

import { type PanelProps, Panel as PanelRoot } from "./panel";
import { PanelContent, type PanelContentProps, panelContentVariants } from "./panel-content";
import { PanelDescription, type PanelDescriptionProps } from "./panel-description";
import { PanelFooter, type PanelFooterProps } from "./panel-footer";
import { PanelHeader, type PanelHeaderProps } from "./panel-header";
import { PanelLabel, type PanelLabelProps } from "./panel-label";
import { PanelRow, type PanelRowProps } from "./panel-row";
import { PanelTitle, type PanelTitleProps } from "./panel-title";

/**
 * Root container. Polymorphic via `as` (div, article, section, aside). Switches to <section>
 * automatically when Panel.Title or aria-label is present.
 */
const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Title: PanelTitle,
  Description: PanelDescription,
  Content: PanelContent,
  Row: PanelRow,
  Footer: PanelFooter,
  Label: PanelLabel,
});

export { Panel, type PanelProps };
export { PanelHeader, type PanelHeaderProps };
export { PanelTitle, type PanelTitleProps };
export { PanelDescription, type PanelDescriptionProps };
export { PanelContent, type PanelContentProps, panelContentVariants };
export { PanelFooter, type PanelFooterProps };
export { PanelRow, type PanelRowProps };
export { PanelLabel, type PanelLabelProps };
