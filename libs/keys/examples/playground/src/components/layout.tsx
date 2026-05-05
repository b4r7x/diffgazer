import type { ReactNode } from "react";

interface DemoItem {
  id: string;
  title: string;
  section: string;
}

interface LayoutProps {
  demos: DemoItem[];
  activeDemo: string;
  onSelect: (id: string) => void;
  children: ReactNode;
}

export function Layout({ demos, activeDemo, onSelect, children }: LayoutProps) {
  const sections = new Map<string, DemoItem[]>();
  for (const demo of demos) {
    const list = sections.get(demo.section) ?? [];
    list.push(demo);
    sections.set(demo.section, list);
  }

  return (
    <div className="playground-layout">
      <nav className="playground-sidebar">
        <div className="playground-sidebar__logo">@diffgazer/keys</div>
        {[...sections.entries()].map(([section, items]) => (
          <div key={section} className="playground-sidebar__section">
            <div className="playground-sidebar__section-label">{section}</div>
            {items.map((item) => (
              <button
                key={item.id}
                className={`playground-sidebar__item${item.id === activeDemo ? " playground-sidebar__item--active" : ""}`}
                onClick={() => onSelect(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <main className="playground-main">{children}</main>
    </div>
  );
}
