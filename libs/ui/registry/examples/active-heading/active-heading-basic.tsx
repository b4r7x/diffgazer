"use client";

import { useActiveHeading } from "@/hooks/use-active-heading";

const sections = [
  { id: "overview", title: "Overview" },
  { id: "installation", title: "Installation" },
  { id: "usage", title: "Usage" },
  { id: "api", title: "API Reference" },
];

export default function ActiveHeadingBasic() {
  const ids = sections.map((s) => s.id);
  const { activeId, scrollTo } = useActiveHeading({ ids });

  return (
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
              Content for the {section.title.toLowerCase()} section. Scroll to see the active
              heading update in the sidebar navigation.
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
