"use client";

import { useId } from "react";
import { useActiveHeading } from "@/hooks/use-active-heading";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "installation", title: "Installation" },
  { id: "usage", title: "Usage" },
  { id: "api", title: "API Reference" },
];

export default function ActiveHeadingBasic() {
  // useActiveHeading resolves headings with document.getElementById, which
  // returns the first match in the whole page. Bare slugs like "installation"
  // would resolve to the host page's own anchor instead of this demo's heading,
  // so every id here is namespaced per instance.
  const uid = useId();
  const headingId = (id: string) => `${uid}-${id}`;
  const ids = sections.map((s) => headingId(s.id));
  const containerId = `${uid}-pane`;
  const { activeId, scrollTo } = useActiveHeading({ ids, containerId, topOffset: 24 });

  return (
    <div className="flex gap-8">
      <nav className="flex w-48 shrink-0 flex-col gap-1 self-start">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`px-3 py-1 text-left text-sm transition-colors ${
              activeId === headingId(section.id)
                ? "border-l-2 border-success-border text-foreground"
                : "border-l-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => scrollTo(headingId(section.id))}
          >
            {section.title}
          </button>
        ))}
      </nav>

      <div
        id={containerId}
        className="h-64 min-w-0 flex-1 overflow-y-auto border border-border p-4"
      >
        <div className="flex flex-col gap-16 pb-40">
          {sections.map((section) => (
            <section key={section.id}>
              <h2 id={headingId(section.id)} className="mb-4 text-lg font-medium text-foreground">
                {section.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                Content for the {section.title.toLowerCase()} section. Scroll to see the active
                heading update in the sidebar navigation.
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
