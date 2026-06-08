import { Button } from "@diffgazer/ui/components/button";
import { Panel, PanelContent, PanelHeader } from "@diffgazer/ui/components/panel";
import { orderThemeDocsPrimitives, THEME_DOCS_PLAYGROUND_ORDER } from "@diffgazer/ui/theme";
import { useState } from "react";
import { ColorPickerRow } from "./color-picker-row";
import { CssOutput } from "./css-output";
import { PreviewPanel } from "./preview-panel";

const DEFAULT_PRIMITIVES: Record<string, string> = Object.fromEntries(
  orderThemeDocsPrimitives(THEME_DOCS_PLAYGROUND_ORDER).map((primitive) => [
    primitive.name,
    primitive.darkValue,
  ]),
);

export function ThemePlayground() {
  const [primitives, setPrimitives] = useState<Record<string, string>>(() => ({
    ...DEFAULT_PRIMITIVES,
  }));

  const handleChange = (key: string, value: string) => {
    setPrimitives((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setPrimitives({ ...DEFAULT_PRIMITIVES });
  };

  const scopedStyle = primitives as React.CSSProperties;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <PanelHeader>
            <span>Primitives</span>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
          </PanelHeader>
          <PanelContent spacing="sm">
            {Object.entries(primitives).map(([key, value]) => (
              <ColorPickerRow
                key={key}
                name={key}
                value={value}
                onChange={(v) => handleChange(key, v)}
              />
            ))}
          </PanelContent>
        </Panel>

        <Panel>
          <PanelHeader>Preview</PanelHeader>
          <PanelContent spacing="none">
            <div style={scopedStyle}>
              <PreviewPanel />
            </div>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>Generated CSS</PanelHeader>
        <PanelContent spacing="none">
          <CssOutput primitives={primitives} defaults={DEFAULT_PRIMITIVES} />
        </PanelContent>
      </Panel>
    </div>
  );
}
