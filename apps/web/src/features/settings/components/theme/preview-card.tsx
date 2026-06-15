import { Badge } from "@diffgazer/ui/components/badge";
import { Menu, MenuItem } from "@diffgazer/ui/components/menu";
import { Panel } from "@diffgazer/ui/components/panel";
import type { ResolvedTheme } from "@/types/theme";

interface ThemePreviewCardProps {
  previewTheme: ResolvedTheme;
}

export function ThemePreviewCard({ previewTheme }: ThemePreviewCardProps) {
  return (
    <section
      aria-label="Theme preview"
      data-theme={previewTheme}
      className="w-full h-full flex items-center justify-center bg-background p-6"
      style={{ colorScheme: previewTheme }}
    >
      <div className="w-full max-w-sm font-mono text-xs isolate">
        <Panel className="bg-background border-border">
          <Panel.Header marker="none">
            <Panel.Title as="h3" className="font-normal">
              PREVIEW.tsx
            </Panel.Title>
            <span className="text-foreground">RO</span>
          </Panel.Header>
          <Panel.Content spacing="none">
            {/* Decorative only: `inert` removes the mock Menu from keyboard/AT reach (F-233). */}
            <div inert>
              <Menu selectedId="selected" onSelect={() => {}}>
                <MenuItem id="normal">Normal Item</MenuItem>
                <MenuItem id="selected">Selected Item</MenuItem>
                <MenuItem id="disabled" disabled>
                  Disabled Item
                </MenuItem>
              </Menu>
            </div>

            <div className="border-t border-border my-2" />

            <div className="px-4 py-2 space-y-1">
              <div className="text-foreground">Primary text color</div>
              <div className="text-muted-foreground">Muted text color</div>
              <div className="text-info-text">Accent blue color</div>
              <div className="text-accent">Accent violet color</div>
            </div>

            <div className="border-t border-border my-2" />

            <div className="px-4 py-2 flex flex-wrap gap-2">
              <Badge variant="error">Error</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </Panel.Content>
          <div className="px-3 py-1 text-center text-2xs text-muted-foreground border-t border-border">
            Diffgazer v2.0
          </div>
        </Panel>
      </div>
    </section>
  );
}
