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
    <Sidebar variant="tree" embedded aria-label="Documentation tree" className="h-full w-full">
      <SidebarContent className="overflow-hidden p-0">
        {/* scroll-pt/pb mirror the inner padding: the active-item scrollIntoView
            otherwise parks a row flush with the clipped edge, cutting its 4px
            focus-ring outset. Restoration sets scrollTop directly and is unaffected. */}
        <ScrollArea
          className="h-full scroll-pt-2 scroll-pb-4"
          data-scroll-restoration-id={SIDEBAR_SCROLL_RESTORATION_ID}
        >
          <div className="px-3 pt-2 pb-4" ref={innerRef}>
            {children}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
}
