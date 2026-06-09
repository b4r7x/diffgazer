import { Panel } from "@diffgazer/ui/components/panel";

/** Corner label on the panel border (registry / file-manager hub aesthetic). */
export function HubCornerLabel({ children }: { children: string }) {
  return (
    <>
      <Panel.Title className="sr-only">{children}</Panel.Title>
      <Panel.Label variant="border">{children}</Panel.Label>
    </>
  );
}
