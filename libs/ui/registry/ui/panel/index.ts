import { Panel as PanelRoot, type PanelProps, panelVariants } from "./panel";
import { PanelHeader, type PanelHeaderProps, panelHeaderVariants } from "./panel-header";
import { PanelContent, type PanelContentProps, panelContentVariants } from "./panel-content";
import { PanelFooter, type PanelFooterProps } from "./panel-footer";

const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
  Footer: PanelFooter,
});

export { Panel, type PanelProps, panelVariants };
export { PanelHeader, type PanelHeaderProps, panelHeaderVariants };
export { PanelContent, type PanelContentProps, panelContentVariants };
export { PanelFooter, type PanelFooterProps };
