"use client";

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
  const ids = sections.map((s) => s.id);
  const { activeId, scrollTo } = useActiveHeading({ ids });

  return (
    <div className="flex gap-8">
      <Toc title="On this page" className="sticky top-24 w-full max-w-xs self-start py-0 pr-0">
        <TocList>
          {sections.map((section) => (
            <TocItem
              key={section.id}
              href={`#${section.id}`}
              depth={section.depth}
              active={activeId === section.id}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(section.id);
              }}
            >
              {section.title}
            </TocItem>
          ))}
        </TocList>
      </Toc>

      <div className="flex flex-col gap-16">
        {sections.map((section) => {
          const Heading = headingByDepth[section.depth];
          return (
            <section key={section.id}>
              <Heading id={section.id} className="mb-4 text-lg font-medium text-foreground">
                {section.title}
              </Heading>
              <p className="text-sm text-muted-foreground">
                Content for the {section.title.toLowerCase()} section. Scroll to see the active
                heading update in the sidebar.
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
