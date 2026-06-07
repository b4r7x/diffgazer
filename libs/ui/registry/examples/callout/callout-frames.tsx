import { Callout } from "@/components/ui/callout";

export default function CalloutFrames() {
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info" frame="inline">
        <Callout.Icon />
        <Callout.Title>Inline frame (default)</Callout.Title>
        <Callout.Content>
          Hairline border at tone color with a subtle tone background.
        </Callout.Content>
      </Callout>

      <Callout tone="warning" frame="rail">
        <Callout.Icon />
        <Callout.Title>Rail frame</Callout.Title>
        <Callout.Content>
          2px inline-start rail at tone color, lightest visual weight.
        </Callout.Content>
      </Callout>

      <Callout tone="error" frame="bar">
        <Callout.Icon />
        <Callout.Title>Bar frame</Callout.Title>
        <Callout.Content>
          Neutral hairline border with a 4px tone marker bar — matches Dialog.Header marker="bar".
        </Callout.Content>
      </Callout>
    </div>
  );
}
