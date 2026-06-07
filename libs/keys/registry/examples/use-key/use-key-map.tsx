"use client";

import { KeyboardProvider, useKey } from "@diffgazer/keys";
import { useState } from "react";

function TextFormatter() {
  const [style, setStyle] = useState<"normal" | "bold" | "italic" | "underline">("normal");

  useKey({
    "ctrl+b": () => setStyle("bold"),
    "ctrl+i": () => setStyle("italic"),
    "ctrl+u": () => setStyle("underline"),
    Escape: () => setStyle("normal"),
  });

  return (
    <div>
      <p
        style={{
          fontWeight: style === "bold" ? 700 : 400,
          fontStyle: style === "italic" ? "italic" : "normal",
          textDecoration: style === "underline" ? "underline" : "none",
        }}
      >
        The quick brown fox jumps over the lazy dog.
      </p>
      <p>Active: {style}</p>
      <p>Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Esc reset.</p>
    </div>
  );
}

export default function UseKeyMap() {
  return (
    <KeyboardProvider>
      <TextFormatter />
    </KeyboardProvider>
  );
}
