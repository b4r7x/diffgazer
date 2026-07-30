import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Sidebar, SidebarContent } from "@diffgazer/ui/components/sidebar";
import type { ReactNode, Ref } from "react";
import { SIDEBAR_SCROLL_RESTORATION_ID } from "@/lib/sidebar-scroll-bootstrap";

export function TreeSidebarShell({
  children,
  innerRef,
}: {
  children: ReactNode;
  innerRef?: Ref<HTMLDivElement>;
}) {
  return (
    // A provider-less Sidebar never binds the global Cmd/Ctrl+B hotkey, so the
    // docs chrome nav stays inert while sidebar demos on the page own it
    // (guarded by sidebar-navigation.test).
    <Sidebar variant="tree" embedded className="h-full w-full">
      <SidebarContent className="overflow-hidden p-0">
        <ScrollArea className="h-full" data-scroll-restoration-id={SIDEBAR_SCROLL_RESTORATION_ID}>
          <div className="px-3 pt-2 pb-4" ref={innerRef}>
            {children}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
