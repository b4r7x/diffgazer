import { Pager, PagerLink } from "@/components/ui/pager"

export default function PagerDefault() {
  return (
    <Pager>
      <PagerLink direction="previous" href="/docs/components/button">button</PagerLink>
      <PagerLink direction="next" href="/docs/components/checkbox">checkbox</PagerLink>
    </Pager>
  )
}
