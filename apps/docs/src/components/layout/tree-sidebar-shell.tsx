import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Sidebar, SidebarContent } from "@diffgazer/ui/components/sidebar";
import type { ReactNode, Ref } from "react";

export function TreeSidebarShell({
  children,
  innerRef,
}: {
  children: ReactNode;
  innerRef?: Ref<HTMLDivElement>;
}) {
  return (
    <Sidebar variant="tree" embedded className="h-full w-full">
      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="px-3 pt-2 pb-4" ref={innerRef}>
            {children}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
