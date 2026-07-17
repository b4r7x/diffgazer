import type { HookDoc } from "@diffgazer/registry";

export const isMobileDoc: HookDoc = {
  description:
    "Responsive media-query hook that returns true below a breakpoint. It uses useSyncExternalStore so server and client snapshots stay predictable.",
  usage: {
    code: `const isMobile = useIsMobile();

return isMobile ? <MobileNav /> : <DesktopNav />;`,
    lang: "tsx",
  },
  parameters: [
    {
      name: "breakpoint",
      type: "number",
      required: false,
      defaultValue: "1024",
      description:
        "Pixel breakpoint. The hook matches max-width: breakpoint - 1px, so the default is mobile below 1024px.",
    },
    {
      name: "owner",
      type: "Window | RefObject<Element | null>",
      required: false,
      description:
        "Window or element ref whose owner window supplies matchMedia. Pass it when rendering into an iframe or another document.",
    },
  ],
  returns: {
    type: "boolean",
    description:
      "True when the viewport is narrower than the breakpoint; false during server rendering.",
  },
  notes: [
    {
      title: "Server Snapshot",
      content:
        "Server rendering returns false. Use this hook for responsive enhancement after hydration, not for markup that must be identical across breakpoints before hydration.",
    },
    {
      title: "Media Query",
      content:
        "The subscribed query is (max-width: breakpoint - 1px). With the default 1024 breakpoint, 1023px and below return true.",
    },
    {
      title: "Owner Window",
      content:
        "By default the hook uses the current global window. Pass a Window or an element ref to classify and subscribe against another document's viewport.",
    },
  ],
  tags: ["hook", "responsive", "media-query"],
};
