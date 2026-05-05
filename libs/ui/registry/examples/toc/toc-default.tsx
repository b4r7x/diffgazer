import { Toc, TocItem, TocList } from "@/components/ui/toc"

const items = [
  { title: "Overview", href: "#overview", depth: 2 },
  { title: "Installation", href: "#installation", depth: 2 },
  { title: "Configuration", href: "#configuration", depth: 2 },
]

export default function TocDefault() {
  return (
    <Toc title="On this page" className="w-full max-w-xs py-0 pr-0">
      <TocList>
        {items.map((item) => (
          <TocItem key={item.href} href={item.href} depth={item.depth}>
            {item.title}
          </TocItem>
        ))}
      </TocList>
    </Toc>
  )
}
