"use client";

import { KeyboardProvider, useFocusZone, useScopedNavigation } from "@diffgazer/keys";
import { useId, useRef } from "react";

type Zone = "sidebar" | "main";

function Layout() {
  const { zone, isZone } = useFocusZone<Zone>({
    initial: "sidebar",
    zones: ["sidebar", "main"],
    transitions: ({ zone, key }) => {
      if (zone === "sidebar" && key === "ArrowRight") return "main";
      if (zone === "main" && key === "ArrowLeft") return "sidebar";
      return null;
    },
  });

  return (
    <div>
      <p>
        <span style={{ fontWeight: zone === "sidebar" ? 700 : 400 }}>Sidebar</span>
        {" / "}
        <span style={{ fontWeight: zone === "main" ? 700 : 400 }}>Main</span>
        {" -- ArrowLeft / ArrowRight switch zones"}
      </p>
      <div style={{ display: "flex", gap: 16 }}>
        <Pane
          title="Sidebar"
          items={["Dashboard", "Settings", "Profile"]}
          active={isZone("sidebar")}
          enabled={zone === "sidebar"}
        />
        <Pane
          title="Main"
          items={["Item A", "Item B", "Item C", "Item D"]}
          active={isZone("main")}
          enabled={zone === "main"}
        />
      </div>
    </div>
  );
}

function Pane({
  title,
  items,
  active,
  enabled,
}: {
  title: string;
  items: string[];
  active: boolean;
  enabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const { isHighlighted } = useScopedNavigation({
    containerRef,
    role: "option",
    wrap: true,
    enabled,
  });

  return (
    <div
      style={{
        minWidth: 160,
        padding: 8,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: active ? "currentColor" : "transparent",
      }}
    >
      <h4 id={headingId}>{title}</h4>
      <div ref={containerRef} role="listbox" aria-labelledby={headingId}>
        {items.map((item) => (
          // biome-ignore lint/a11y/useFocusableInteractive: WAI-ARIA listbox pattern — options stay non-focusable; the listbox container holds focus and active state is tracked via aria-selected.
          <div
            key={item}
            role="option"
            data-value={item}
            aria-selected={isHighlighted(item)}
            style={{ padding: "4px 8px", fontWeight: isHighlighted(item) ? 700 : 400 }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UseFocusZoneBasic() {
  return (
    <KeyboardProvider>
      <Layout />
    </KeyboardProvider>
  );
}
