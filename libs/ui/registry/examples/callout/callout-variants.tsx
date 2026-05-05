import { Callout, CalloutIcon, CalloutTitle, CalloutContent, CalloutDismiss } from "@/components/ui/callout"

export default function CalloutVariants() {
  return (
    <div className="flex flex-col gap-4">
      <Callout variant="info">
        <CalloutIcon />
        <CalloutTitle>Info</CalloutTitle>
        <CalloutContent>Informational message with helpful details.</CalloutContent>
      </Callout>

      <Callout variant="success">
        <CalloutIcon />
        <CalloutTitle>Success</CalloutTitle>
        <CalloutContent>Operation completed successfully.</CalloutContent>
      </Callout>

      <Callout variant="warning">
        <CalloutIcon />
        <CalloutTitle>Warning</CalloutTitle>
        <CalloutContent>Please review before proceeding.</CalloutContent>
      </Callout>

      <Callout variant="error">
        <CalloutIcon />
        <CalloutTitle>Error</CalloutTitle>
        <CalloutContent>Something went wrong. Please try again.</CalloutContent>
      </Callout>

      <Callout variant="info" layout="inline">
        <CalloutIcon />
        <CalloutTitle>Inline Layout:</CalloutTitle>
        <CalloutContent>Everything in one row that wraps when needed.</CalloutContent>
      </Callout>

      <Callout variant="warning">
        <CalloutIcon />
        <CalloutTitle>Dismissible</CalloutTitle>
        <CalloutContent>Click the dismiss button to close this callout.</CalloutContent>
        <CalloutDismiss />
      </Callout>
    </div>
  )
}
