import { Callout } from "@/components/ui/callout";

export default function CalloutDefault() {
  return (
    <Callout tone="info">
      <Callout.Icon />
      <Callout.Title>Information</Callout.Title>
      <Callout.Content>
        This is an informational callout with a title and body text.
      </Callout.Content>
    </Callout>
  );
}
