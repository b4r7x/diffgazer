import { Toc, TocItem, TocList } from "@/components/ui/toc";

const items = [
  { title: "Overview", href: "#overview", depth: 2, active: false },
  { title: "Installation", href: "#installation", depth: 2, active: true },
  { title: "Configuration", href: "#configuration", depth: 2, active: false },
];

export default function TocDefault() {
  return (
    <Toc title="On this page" className="w-full max-w-xs">
      <TocList>
        {items.map((item) => (
          <TocItem key={item.href} href={item.href} depth={item.depth} active={item.active}>
            {item.title}
          </TocItem>
        ))}
      </TocList>
    </Toc>
  );
}
