"use client";

import "../shared/panel.css";

import { Panel as PanelRoot, type PanelProps } from "./panel";
import { PanelHeader, type PanelHeaderProps } from "./panel-header";
import { PanelTitle, type PanelTitleProps } from "./panel-title";
import { PanelDescription, type PanelDescriptionProps } from "./panel-description";
import {
  PanelContent,
  panelContentVariants,
  type PanelContentProps,
} from "./panel-content";
import { PanelFooter, type PanelFooterProps } from "./panel-footer";
import { PanelRow, type PanelRowProps } from "./panel-row";

const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Title: PanelTitle,
  Description: PanelDescription,
  Content: PanelContent,
  Row: PanelRow,
  Footer: PanelFooter,
});

export { Panel, type PanelProps };
export { PanelHeader, type PanelHeaderProps };
export { PanelTitle, type PanelTitleProps };
export { PanelDescription, type PanelDescriptionProps };
export { PanelContent, type PanelContentProps, panelContentVariants };
export { PanelFooter, type PanelFooterProps };
export { PanelRow, type PanelRowProps };
