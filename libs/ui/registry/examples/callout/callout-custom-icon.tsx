import { Callout } from "@/components/ui/callout";

export default function CalloutCustomIcon() {
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info">
        <Callout.Icon>?</Callout.Icon>
        <Callout.Title>Custom Icon</Callout.Title>
        <Callout.Content>
          Pass any content as children to Callout.Icon to replace the default glyph.
        </Callout.Content>
      </Callout>

      <Callout tone="success">
        <Callout.Icon>★</Callout.Icon>
        <Callout.Title>Featured</Callout.Title>
        <Callout.Content>Icons can be any single character, emoji, or React node.</Callout.Content>
      </Callout>
    </div>
  );
}
