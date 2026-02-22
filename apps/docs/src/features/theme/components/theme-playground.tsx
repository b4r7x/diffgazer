import { useState } from "react"
import { Button } from "@/components/ui/button/button"
import { Panel, PanelHeader, PanelContent } from "@/components/ui/panel"
import { ColorPickerRow } from "./color-picker-row"
import { PreviewPanel } from "./preview-panel"
import { CssOutput } from "./css-output"

const DEFAULT_PRIMITIVES: Record<string, string> = {
  "--tui-bg": "#0a0a0a",
  "--tui-fg": "#e5e5e5",
  "--tui-blue": "#ccccff",
  "--tui-violet": "#666666",
  "--tui-green": "#e5e5e5",
  "--tui-red": "#ff7b72",
  "--tui-yellow": "#d29922",
  "--tui-border": "#333333",
  "--tui-selection": "#333333",
  "--tui-muted": "#666666",
  "--tui-input-bg": "#0a0a0a",
}

export function ThemePlayground() {
  const [primitives, setPrimitives] = useState<Record<string, string>>(
    () => ({ ...DEFAULT_PRIMITIVES })
  )

  const handleChange = (key: string, value: string) => {
    setPrimitives((prev) => ({ ...prev, [key]: value }))
  }

  const handleReset = () => {
    setPrimitives({ ...DEFAULT_PRIMITIVES })
  }

  const scopedStyle = primitives as React.CSSProperties

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel>
          <PanelHeader
            value={
              <Button variant="ghost" size="sm" onClick={handleReset}>
                Reset
              </Button>
            }
          >
            Primitives
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
  )
}
