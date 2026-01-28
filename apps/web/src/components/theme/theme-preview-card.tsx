'use client';

import { Panel } from '@/components/ui/panel';
import { Menu } from '@/components/ui/menu';
import type { ResolvedTheme } from '@/types/theme';

interface ThemePreviewCardProps {
  previewTheme: ResolvedTheme;
}

export function ThemePreviewCard({ previewTheme }: ThemePreviewCardProps) {
  return (
    <div data-theme={previewTheme} className="w-full max-w-xs font-mono text-xs">
      <Panel className="bg-tui-bg">
        <Panel.Header variant="default" value="RO">
          PREVIEW.tsx
        </Panel.Header>
        <Panel.Content spacing="none">
          <Menu
            selectedIndex={1}
            onSelect={() => {}}
            keyboardEnabled={false}
          >
            <Menu.Item id="normal">Normal Item</Menu.Item>
            <Menu.Item id="selected">Selected Item</Menu.Item>
            <Menu.Item id="disabled" disabled>Disabled Item</Menu.Item>
          </Menu>
        </Panel.Content>
        <div className="px-3 py-1 text-center text-[10px] text-tui-muted border-t border-tui-border">
          Stargazer v2.0
        </div>
      </Panel>
    </div>
  );
}
