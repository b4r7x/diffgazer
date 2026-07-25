import { Callout } from "@/components/ui/callout";

export default function CalloutDefault() {
  return (
    <Callout tone="info">
      <Callout.Icon />
      <Callout.Title>Information</Callout.Title>
      <Callout.Content>
        This is an informational callout with a title, body text, and a dismiss button — the full
        anatomy in one instance.
      </Callout.Content>
      <Callout.Dismiss />
    </Callout>
  );
}
