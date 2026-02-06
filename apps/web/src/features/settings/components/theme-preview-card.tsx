import { Panel, PanelHeader, PanelContent } from "@/components/ui/containers";
import { Menu, MenuItem } from "@/components/ui/menu";
import { Badge } from "@/components/ui/badge/badge";
import type { ResolvedTheme } from "@/types/theme";

interface ThemePreviewCardProps {
  previewTheme: ResolvedTheme;
}

export function ThemePreviewCard({ previewTheme }: ThemePreviewCardProps) {
  return (
    <div
      data-theme={previewTheme}
      className="w-full h-full flex items-center justify-center bg-tui-bg p-6"
      style={{ colorScheme: previewTheme }}
    >
      <div className="w-full max-w-sm font-mono text-xs isolate">
        <Panel className="bg-tui-bg border-tui-border">
          <PanelHeader variant="default" value="RO">
            PREVIEW.tsx
          </PanelHeader>
          <PanelContent spacing="none">
            {/* Menu with selection states */}
            <Menu selectedIndex={1} onSelect={() => {}} keyboardEnabled={false}>
              <MenuItem id="normal">Normal Item</MenuItem>
              <MenuItem id="selected">Selected Item</MenuItem>
              <MenuItem id="disabled" disabled>
                Disabled Item
              </MenuItem>
            </Menu>

            {/* Divider */}
            <div className="border-t border-tui-border my-2" />

            {/* Text samples */}
            <div className="px-4 py-2 space-y-1">
              <div className="text-tui-fg">Primary text color</div>
              <div className="text-tui-muted">Muted text color</div>
              <div className="text-tui-blue">Accent blue color</div>
              <div className="text-tui-violet">Accent violet color</div>
            </div>

            {/* Divider */}
            <div className="border-t border-tui-border my-2" />

            {/* Badges */}
            <div className="px-4 py-2 flex flex-wrap gap-2">
              <Badge variant="error">Error</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </PanelContent>
          <div className="px-3 py-1 text-center text-[10px] text-tui-muted border-t border-tui-border">
            Stargazer v2.0
          </div>
        </Panel>
      </div>
    </div>
  );
}
