"use client";

import { type SyntheticEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarProvider,
} from "@/components/ui/sidebar";

const FRAME_DOCUMENT = `<!doctype html>
<html>
  <head><style>html,body,#root{height:100%;margin:0}body{font-family:monospace}</style></head>
  <body></body>
</html>`;

export default function SidebarOwnerWindow() {
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

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
              <Sidebar aria-label="Frame navigation">
                <SidebarHeader>iframe viewport</SidebarHeader>
                <SidebarContent>
                  <SidebarItem as="button">Frame item</SidebarItem>
                </SidebarContent>
              </Sidebar>
            </SidebarProvider>,
            frameBody,
          )
        : null}
    </div>
  );
}
