"use client";

import { type SyntheticEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const FRAME_DOCUMENT = `<!doctype html>
<html>
  <head><style>html,body,#root{height:100%;margin:0}body{font-family:monospace}</style></head>
  <body></body>
</html>`;

export default function SidebarOwnerWindow() {
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);
  // Mounted by default so the frame renders a sidebar instead of an empty box
  // on first paint; the buttons still exercise the mount/unmount lifecycle.
  // The sheet's viewport is the iframe, not the host page: with breakpoint 600
  // and a 420px frame the nav is a mobile sheet however wide the host window is,
  // and resizing the host alone never flips it.
  const [mounted, setMounted] = useState(true);

  const handleFrameLoad = (event: SyntheticEvent<HTMLIFrameElement>) => {
    setFrameBody(event.currentTarget.contentDocument?.body ?? null);
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-background">
      <div className="flex gap-2">
        <button
          type="button"
          className="border border-border px-2 py-1 font-mono text-xs"
          disabled={!frameBody || mounted}
          onClick={() => setMounted(true)}
        >
          Mount frame sidebar
        </button>
        <button
          type="button"
          className="border border-border px-2 py-1 font-mono text-xs"
          disabled={!mounted}
          onClick={() => setMounted(false)}
        >
          Unmount frame sidebar
        </button>
      </div>
      <iframe
        title="Sidebar owner window"
        srcDoc={FRAME_DOCUMENT}
        className="h-72 border border-border bg-background"
        style={{ width: 420 }}
        onLoad={handleFrameLoad}
      />
      {mounted && frameBody
        ? createPortal(
            <SidebarProvider breakpoint={600} shortcutKey={null}>
              <div className="flex items-center gap-2 border-b border-border px-2 py-1 font-mono text-xs">
                <SidebarTrigger />
                <span>~/frame</span>
              </div>
              <Sidebar aria-label="Frame navigation">
                <SidebarHeader>iframe viewport</SidebarHeader>
                <SidebarContent>
                  <SidebarItem as="button" active>
                    overview
                  </SidebarItem>
                  <SidebarItem as="button">requests</SidebarItem>
                  <SidebarItem as="button">console</SidebarItem>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>,
            frameBody,
          )
        : null}
    </div>
  );
}
