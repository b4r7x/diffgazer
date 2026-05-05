import { useState } from "react";
import { useKey, useFocusZone } from "@diffgazer/keys";
import { DemoWrapper } from "../components/demo-wrapper";
import { Kbd } from "../components/kbd";

type Zone = "sidebar" | "content" | "preview";

const ZONE_SHORTCUTS: Record<Zone, { keys: string; label: string }[]> = {
  sidebar: [
    { keys: "Enter", label: "Open item" },
    { keys: "d", label: "Delete item" },
  ],
  content: [
    { keys: "Enter", label: "Start editing" },
    { keys: "e", label: "Toggle edit mode" },
  ],
  preview: [
    { keys: "Escape", label: "Back to content" },
  ],
};

export function FocusZonesDemo() {
  const [lastAction, setLastAction] = useState("No action yet");

  const { zone, setZone, forZone } = useFocusZone<Zone>({
    initial: "sidebar",
    zones: ["sidebar", "content", "preview"] as const,
    tabCycle: ["sidebar", "content", "preview"] as const,
    transitions: ({ zone, key }) => {
      if (zone === "sidebar" && key === "ArrowRight") return "content";
      if (zone === "content" && key === "ArrowLeft") return "sidebar";
      if (zone === "content" && key === "ArrowRight") return "preview";
      if (zone === "preview" && key === "ArrowLeft") return "content";
      return null;
    },
  });

  useKey("Enter", () => setLastAction("Sidebar: opened item"), forZone("sidebar"));
  useKey("Enter", () => setLastAction("Content: editing"), forZone("content"));
  useKey("Escape", () => {
    setLastAction("Preview: back to content");
    setZone("content");
  }, forZone("preview"));
  useKey("d", () => setLastAction("Sidebar: deleted item"), forZone("sidebar"));
  useKey("e", () => setLastAction("Content: toggled edit mode"), forZone("content"));

  return (
    <DemoWrapper
      title="Focus Zones"
      description="Navigate between zones with arrow keys or Tab. Each zone has its own shortcuts that only activate when the zone is focused."
      activeScope={zone}
      hints={[
        { keys: "ArrowLeft", label: "Move to previous zone" },
        { keys: "ArrowRight", label: "Move to next zone" },
        { keys: "Tab", label: "Cycle zones" },
        { keys: "Enter", label: "Zone action (varies)" },
      ]}
    >
      <div style={{ display: "flex", gap: 12 }}>
        {(["sidebar", "content", "preview"] as const).map((z) => (
          <div
            key={z}
            className={`demo-panel${zone === z ? " demo-panel--active" : ""}`}
            onClick={() => setZone(z)}
            style={{ cursor: "pointer" }}
          >
            <span className={`demo-badge${zone === z ? " demo-badge--active" : ""}`}>
              {z}
            </span>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {ZONE_SHORTCUTS[z].map((shortcut, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <Kbd keys={shortcut.keys} />
                  <span style={{ color: "var(--color-text-muted)" }}>{shortcut.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="demo-action-log">
        Last action: {lastAction}
      </div>
    </DemoWrapper>
  );
}
