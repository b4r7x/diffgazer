"use client";

import { useId } from "react";
import { Toc, TocItem, TocList } from "@/components/ui/toc";
import { useActiveHeading } from "@/hooks/use-active-heading";

const sections = [
  { id: "overview", title: "Overview", depth: 2 },
  { id: "installation", title: "Installation", depth: 2 },
  { id: "npm", title: "npm", depth: 3 },
  { id: "pnpm", title: "pnpm", depth: 3 },
  { id: "usage", title: "Usage", depth: 2 },
] as const;

const headingByDepth = {
  2: "h2",
  3: "h3",
} as const;

export default function TocActive() {
  // useActiveHeading resolves headings with document.getElementById, which
  // returns the first match in the whole page. Bare slugs like "installation"
  // would resolve to the host page's own anchor instead of this demo's heading,
  // so every id here is namespaced per instance.
  const uid = useId();
  const headingId = (id: string) => `${uid}-${id}`;
  const ids = sections.map((s) => headingId(s.id));
  // The content lives in a fixed-height scroll container, so the marker starts
  // on the heading the reader can actually see and moves as that pane scrolls.
  const containerId = `${uid}-pane`;
  const { activeId, scrollTo } = useActiveHeading({ ids, containerId, topOffset: 24 });

  return (
    <div className="flex gap-8">
      <Toc title="On this page" className="w-full max-w-xs shrink-0">
        <TocList>
          {sections.map((section) => (
            <TocItem
              key={section.id}
              href={`#${headingId(section.id)}`}
              depth={section.depth}
              active={activeId === headingId(section.id)}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(headingId(section.id));
              }}
            >
              {section.title}
            </TocItem>
          ))}
        </TocList>
      </Toc>

      <div
        id={containerId}
        className="h-64 min-w-0 flex-1 overflow-y-auto border border-border p-4"
      >
        <div className="flex flex-col gap-16 pb-40">
          {sections.map((section) => {
            const Heading = headingByDepth[section.depth];
            return (
              <section key={section.id}>
                <Heading
                  id={headingId(section.id)}
                  className="mb-4 text-lg font-medium text-foreground"
                >
                  {section.title}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  Content for the {section.title.toLowerCase()} section. Scroll this pane to see the
                  active heading update in the list.
                </p>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
