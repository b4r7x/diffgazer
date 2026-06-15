"use client";

import { useState } from "react";
import { type ActiveHeadingActivation, useActiveHeading } from "@/hooks/use-active-heading";

const sections = [
  { id: "intro", title: "Introduction" },
  { id: "setup", title: "Setup" },
  { id: "config", title: "Configuration" },
  { id: "deploy", title: "Deployment" },
];

export default function ActiveHeadingModes() {
  const [mode, setMode] = useState<ActiveHeadingActivation>("top-line");
  const ids = sections.map((s) => s.id);

  const { activeId, scrollTo } = useActiveHeading({
    ids,
    activation: mode,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Activation mode:</span>
        {(["top-line", "viewport-center"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`border px-2 py-1 text-xs transition-colors ${
              mode === m
                ? "border-success-border bg-success-subtle text-success-text"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex gap-8">
        <nav className="sticky top-24 flex w-48 shrink-0 flex-col gap-1 self-start">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`px-3 py-1 text-left text-sm transition-colors ${
                activeId === section.id
                  ? "border-l-2 border-success-border text-foreground"
                  : "border-l-2 border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => scrollTo(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-16">
          {sections.map((section) => (
            <section key={section.id}>
              <h2 id={section.id} className="mb-4 text-lg font-medium text-foreground">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                Content for {section.title.toLowerCase()}. Switch between top-line and
                viewport-center modes to see how the active heading detection changes.
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
