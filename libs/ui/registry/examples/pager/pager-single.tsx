import { Pager, PagerLink } from "@/components/ui/pager";

export default function PagerSingle() {
  return (
    <Pager>
      <PagerLink direction="next" href="/ui/getting-started">
        Getting Started
      </PagerLink>
    </Pager>
  );
}
