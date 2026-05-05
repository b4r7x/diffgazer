import { Toc, TocItem, TocList } from "@/components/ui/toc"

const items = [
  { title: "Getting Started", href: "#getting-started", depth: 2, active: true },
  { title: "Installation", href: "#installation", depth: 3, active: false },
  { title: "Provider Setup", href: "#provider-setup", depth: 3, active: false },
  { title: "Advanced Usage", href: "#advanced-usage", depth: 2, active: false },
]

export default function TocDepth() {
  return (
    <Toc title="On this page" className="w-full max-w-xs py-0 pr-0">
      <TocList>
        {items.map((item) => (
          <TocItem
            key={item.href}
            href={item.href}
            depth={item.depth}
            active={item.active}
          >
            {item.title}
          </TocItem>
        ))}
      </TocList>
    </Toc>
  )
}
