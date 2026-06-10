import { Panel } from "@diffgazer/ui/components/panel";

/** Corner label on the panel border (registry / file-manager hub aesthetic). */
export function HubCornerLabel({ children }: { children: string }) {
  return (
    <Panel.Label variant="border" aria-hidden="true">
      {children}
    </Panel.Label>
  );
}
