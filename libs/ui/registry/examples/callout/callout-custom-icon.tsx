import { Callout, CalloutIcon, CalloutTitle, CalloutContent } from "@/components/ui/callout"

export default function CalloutCustomIcon() {
  return (
    <div className="flex flex-col gap-4">
      <Callout variant="info">
        <CalloutIcon>?</CalloutIcon>
        <CalloutTitle>Custom Icon</CalloutTitle>
        <CalloutContent>Pass any content as children to CalloutIcon to replace the default character.</CalloutContent>
      </Callout>

      <Callout variant="success">
        <CalloutIcon>★</CalloutIcon>
        <CalloutTitle>Featured</CalloutTitle>
        <CalloutContent>Icons can be any single character, emoji, or React node.</CalloutContent>
      </Callout>
    </div>
  )
}
