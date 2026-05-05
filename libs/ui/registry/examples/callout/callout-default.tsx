import { Callout, CalloutIcon, CalloutTitle, CalloutContent } from "@/components/ui/callout"

export default function CalloutDefault() {
  return (
    <Callout variant="info">
      <CalloutIcon />
      <CalloutTitle>Information</CalloutTitle>
      <CalloutContent>This is an informational callout with a title and body text.</CalloutContent>
    </Callout>
  )
}
