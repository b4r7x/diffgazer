import { Callout } from "@/components/ui/callout";

export default function CalloutTones() {
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info">
        <Callout.Icon />
        <Callout.Title>Info</Callout.Title>
        <Callout.Content>Informational message with helpful details.</Callout.Content>
      </Callout>

      <Callout tone="success">
        <Callout.Icon />
        <Callout.Title>Success</Callout.Title>
        <Callout.Content>Operation completed successfully.</Callout.Content>
      </Callout>

      <Callout tone="warning">
        <Callout.Icon />
        <Callout.Title>Warning</Callout.Title>
        <Callout.Content>Please review before proceeding.</Callout.Content>
      </Callout>

      <Callout tone="error">
        <Callout.Icon />
        <Callout.Title>Error</Callout.Title>
        <Callout.Content>Something went wrong. Please try again.</Callout.Content>
      </Callout>

      <Callout tone="success">
        <Callout.Title>No icon</Callout.Title>
        <Callout.Content>
          Omit Callout.Icon and the icon column collapses — the title starts at the frame edge.
        </Callout.Content>
      </Callout>
    </div>
  );
}
