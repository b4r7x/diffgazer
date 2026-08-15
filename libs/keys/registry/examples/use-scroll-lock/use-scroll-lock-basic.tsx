"use client";

import { useScrollLock } from "@diffgazer/keys";
import { type RefObject, useRef, useState } from "react";

function Overlay({
  onClose,
  panelRef,
}: {
  onClose: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
}) {
  useScrollLock({ target: panelRef });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <button
        type="button"
        aria-label="Close overlay"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          padding: 0,
          background: "rgba(0,0,0,0.6)",
          cursor: "pointer",
        }}
      />
      <div style={{ position: "relative", padding: 16, background: "white", color: "black" }}>
        <h3>Overlay</h3>
        <p>Panel scroll is locked while this overlay is visible.</p>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default function UseScrollLockBasic() {
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={panelRef}
      style={{
        height: 200,
        overflow: "auto",
        border: "1px solid currentColor",
        padding: 8,
      }}
    >
      <p>Scroll status: {open ? "locked" : "unlocked"}</p>
      <button type="button" onClick={() => setOpen(true)}>
        Show Overlay
      </button>
      <p>Scroll inside this panel, then open the overlay to lock it.</p>
      {Array.from({ length: 12 }, (_, index) => `Scrollable row ${index + 1}`).map((row) => (
        <p key={row} style={{ margin: "4px 0" }}>
          {row}
        </p>
      ))}
      {open && <Overlay onClose={() => setOpen(false)} panelRef={panelRef} />}
    </div>
  );
}
