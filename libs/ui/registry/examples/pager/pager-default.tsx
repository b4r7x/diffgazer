import { Pager, PagerLink } from "@/components/ui/pager";

export default function PagerDefault() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Pager>
        <PagerLink direction="previous" href="/ui/components/button">
          Button
        </PagerLink>
        <PagerLink direction="next" href="/ui/components/checkbox">
          Checkbox
        </PagerLink>
      </Pager>
    </div>
  );
}
