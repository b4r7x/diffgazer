"use client";

import { KeyboardProvider, useKey } from "@diffgazer/keys";
import { useRef, useState } from "react";

function Editor() {
  const [saved, setSaved] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // focusWithinOnly + containerRef: the shortcut only fires while focus is
  // inside this card, so two editors on one page do not collide.
  useKey("ctrl+s", () => setSaved((n) => n + 1), {
    containerRef: cardRef,
    focusWithinOnly: true,
    preventDefault: true,
    allowInInput: true,
  });

  return (
    <div ref={cardRef} style={{ padding: 12, border: "1px solid currentColor" }}>
      <p>Click into the textarea, then press Ctrl+S. Saves: {saved}</p>
      <textarea
        aria-label="Note"
        rows={2}
        style={{ width: "100%" }}
        defaultValue="Focus me, then Ctrl+S"
      />
    </div>
  );
}

export default function UseKeyScoped() {
  return (
    <KeyboardProvider>
      <div style={{ display: "grid", gap: 8 }}>
        <Editor />
        <Editor />
        <p>Each card owns its own Ctrl+S; the binding is inert unless its card has focus.</p>
      </div>
    </KeyboardProvider>
  );
}
