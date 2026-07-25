import { Spinner } from "@/components/ui/spinner";

export default function SpinnerGapAndSpeed() {
  return (
    <div className="flex flex-col items-start gap-4">
      <Spinner gap="none">
        <span className="text-muted-foreground">gap="none"</span>
      </Spinner>
      <Spinner gap="lg">
        <span className="text-muted-foreground">gap="lg"</span>
      </Spinner>
      <Spinner speed={40}>
        <span className="text-muted-foreground">speed=&#123;40&#125; (fast)</span>
      </Spinner>
      <Spinner speed={400}>
        <span className="text-muted-foreground">speed=&#123;400&#125; (slow)</span>
      </Spinner>
    </div>
  );
}
