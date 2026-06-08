"use client";

import { KeyboardProvider, useFocusZone } from "@diffgazer/keys";
import { useRef } from "react";

type Zone = "search" | "results" | "preview";
const zones = ["search", "results", "preview"] as const;

function FinderLayout() {
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { zone, getZoneProps } = useFocusZone<Zone>({
    initial: "search",
    zones,
    // Tab / Shift+Tab cycle through the three regions in order.
    tabCycle: zones,
    allowInInput: true,
    focus: {
      targets: {
        search: searchRef,
        results: resultsRef,
        preview: previewRef,
      },
    },
  });

  const paneStyle = (z: Zone) => ({
    flex: 1,
    minWidth: 120,
    padding: 8,
    border: "1px solid currentColor",
    outline: zone === z ? "2px solid currentColor" : "none",
  });

  return (
    <div>
      <p>Tab and Shift+Tab cycle Search → Results → Preview. Active zone: {zone}.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <div {...getZoneProps("search")} style={paneStyle("search")}>
          <input
            ref={searchRef}
            aria-label="Search"
            placeholder="Search"
            style={{ width: "100%" }}
          />
        </div>
        <div
          ref={resultsRef}
          tabIndex={-1}
          {...getZoneProps("results")}
          style={paneStyle("results")}
        >
          Results
        </div>
        <div
          ref={previewRef}
          tabIndex={-1}
          {...getZoneProps("preview")}
          style={paneStyle("preview")}
        >
          Preview
        </div>
      </div>
    </div>
  );
}

export default function UseFocusZoneTabCycle() {
  return (
    <KeyboardProvider>
      <FinderLayout />
    </KeyboardProvider>
  );
}
