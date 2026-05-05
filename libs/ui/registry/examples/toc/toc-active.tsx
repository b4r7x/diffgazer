"use client"

import { Toc, TocItem, TocList } from "@/components/ui/toc"
import { useActiveHeading } from "@/hooks/use-active-heading"

const sections = [
  { id: "overview", title: "Overview", depth: 2 },
  { id: "installation", title: "Installation", depth: 2 },
  { id: "npm", title: "npm", depth: 3 },
  { id: "pnpm", title: "pnpm", depth: 3 },
  { id: "usage", title: "Usage", depth: 2 },
]

export default function TocActive() {
  const ids = sections.map((s) => s.id)
  const { activeId, scrollTo } = useActiveHeading({ ids })

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
                e.preventDefault()
                scrollTo(section.id)
              }}
            >
              {section.title}
            </TocItem>
          ))}
        </TocList>
      </Toc>

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
              see the active heading update in the sidebar.
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
