import { Pager, PagerLink } from "@/components/ui/pager"

export default function PagerDefault() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Pager>
        <PagerLink direction="previous" href="/docs/components/button">Button</PagerLink>
        <PagerLink direction="next" href="/docs/components/checkbox">Checkbox</PagerLink>
      </Pager>
    </div>
  )
}
