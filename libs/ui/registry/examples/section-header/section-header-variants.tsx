import { SectionHeader } from "@/components/ui/section-header";

export default function SectionHeaderVariants() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionHeader as="h2">Level h2 — section title</SectionHeader>
        <SectionHeader as="h3">Level h3 — default label</SectionHeader>
        <SectionHeader as="h4">Level h4 — smallest label</SectionHeader>
      </div>

      <div className="flex flex-col gap-3">
        <SectionHeader variant="default">Default tone</SectionHeader>
        <SectionHeader variant="muted">Muted tone</SectionHeader>
        <SectionHeader variant="accent">Accent tone</SectionHeader>
      </div>

      <div className="max-w-md">
        <SectionHeader as="h2" bordered className="mb-2">
          Bordered
        </SectionHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The bottom border turns the label into a section boundary above its content.
        </p>
      </div>
    </div>
  );
}
