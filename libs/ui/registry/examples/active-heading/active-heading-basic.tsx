"use client"

import { useActiveHeading } from "@/hooks/use-active-heading"

const sections = [
  { id: "overview", title: "Overview" },
  { id: "installation", title: "Installation" },
  { id: "usage", title: "Usage" },
  { id: "api", title: "API Reference" },
]

export default function ActiveHeadingBasic() {
  const ids = sections.map((s) => s.id)
  const { activeId, scrollTo } = useActiveHeading({ ids })

  return (
    <div className="flex gap-8">
      <nav className="sticky top-24 flex w-48 shrink-0 flex-col gap-1 self-start">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={`px-3 py-1 text-left text-sm transition-colors ${
              activeId === section.id
                ? "border-l-2 border-green-500 text-neutral-100"
                : "border-l-2 border-transparent text-neutral-500 hover:text-neutral-300"
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
            <h2
              id={section.id}
              className="mb-4 text-lg font-medium text-neutral-100"
            >
              {section.title}
            </h2>
            <p className="text-sm text-neutral-400">
              Content for the {section.title.toLowerCase()} section. Scroll to
              see the active heading update in the sidebar navigation.
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
