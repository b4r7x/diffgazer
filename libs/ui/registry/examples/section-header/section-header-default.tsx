import { SectionHeader } from "@/components/ui/section-header";

export default function SectionHeaderDefault() {
  return (
    <div className="max-w-md">
      <SectionHeader as="h2" bordered className="mb-3">
        Review Findings
      </SectionHeader>
      <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
        Three findings across two files. Severity comes from the analyzer, not from the diff size.
      </p>

      <SectionHeader className="mb-2">Blocking</SectionHeader>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The retry loop swallows the original rejection, so the failing request is never reported.
      </p>
    </div>
  );
}
