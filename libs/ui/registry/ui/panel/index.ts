import { Panel as PanelRoot, type PanelProps, panelVariants } from "./panel";
import { PanelHeader, type PanelHeaderProps, panelHeaderVariants } from "./panel-header";
import { PanelContent, type PanelContentProps, panelContentVariants } from "./panel-content";
import { PanelFooter, type PanelFooterProps } from "./panel-footer";
import { PanelLegend, type PanelLegendProps, panelLegendVariants } from "./panel-legend";

const Panel = Object.assign(PanelRoot, {
  Legend: PanelLegend,
  Header: PanelHeader,
  Content: PanelContent,
  Footer: PanelFooter,
});

export { Panel, type PanelProps, panelVariants };
export { PanelLegend, type PanelLegendProps, panelLegendVariants };
export { PanelHeader, type PanelHeaderProps, panelHeaderVariants };
export { PanelContent, type PanelContentProps, panelContentVariants };
export { PanelFooter, type PanelFooterProps };
