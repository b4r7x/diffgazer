import { Button } from "@diffgazer/ui/components/button";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@diffgazer/ui/components/panel";
import { useState } from "react";
import { type DocsTheme, useTheme } from "@/hooks/theme-context";
import { orderThemeDocsPrimitives, THEME_DOCS_PLAYGROUND_ORDER } from "../lib/token-presentation";
import { ColorPickerRow } from "./color-picker-row";
import { CssOutput } from "./css-output";
import { PreviewPanel } from "./preview-panel";

function buildDefaultPrimitives(theme: DocsTheme): Record<string, string> {
  return Object.fromEntries(
    orderThemeDocsPrimitives(THEME_DOCS_PLAYGROUND_ORDER).map((primitive) => [
      primitive.name,
      theme === "light" ? primitive.lightValue : primitive.darkValue,
    ]),
  );
}

/** Only edited primitives override the preview; unedited values inherit the adopted document theme. */
function buildPreviewOverrides(
  primitives: Record<string, string>,
  defaults: Record<string, string>,
): React.CSSProperties | undefined {
  const overrides = Object.fromEntries(
    Object.entries(primitives).filter(([key, value]) => value !== defaults[key]),
  );
  return Object.keys(overrides).length > 0 ? (overrides as React.CSSProperties) : undefined;
}

export function ThemePlayground() {
  const { theme } = useTheme();
  const [primitives, setPrimitives] = useState<Record<string, string>>(() =>
    buildDefaultPrimitives(theme),
  );
  const [editedTheme, setEditedTheme] = useState<DocsTheme>(theme);

  const defaults = buildDefaultPrimitives(theme);

  // Reset the edited primitives to the new theme's defaults when the site theme
  // switches, so the playground always edits the palette it previews.
  if (editedTheme !== theme) {
    setEditedTheme(theme);
    setPrimitives(defaults);
  }

  const handleChange = (key: string, value: string) => {
    setPrimitives((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setPrimitives(defaults);
  };

  const previewStyle = buildPreviewOverrides(primitives, defaults);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <PanelHeader>
            <PanelTitle as="h3">Primitives</PanelTitle>
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
          <PanelHeader>
            <PanelTitle as="h3">Preview</PanelTitle>
          </PanelHeader>
          <PanelContent spacing="none">
            <div style={previewStyle}>
              <PreviewPanel />
            </div>
          </PanelContent>
        </Panel>
      </div>

      <Panel>
        <PanelHeader>
          <PanelTitle as="h3">Generated CSS</PanelTitle>
        </PanelHeader>
        <PanelContent spacing="none">
          <CssOutput theme={theme} primitives={primitives} defaults={defaults} />
        </PanelContent>
      </Panel>
    </div>
  );
}
