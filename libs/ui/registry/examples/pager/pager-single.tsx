import { Pager, PagerLink } from "@/components/ui/pager"

export default function PagerSingle() {
  return (
    <Pager>
      <PagerLink direction="next" href="/docs/getting-started">Getting Started</PagerLink>
    </Pager>
  )
}
