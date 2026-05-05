import { SectionHeader } from "@/components/ui/section-header"

export default function SectionHeaderVariants() {
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader variant="default" as="h2">Default Variant (h2)</SectionHeader>
      <SectionHeader variant="default" as="h3">Default Variant (h3)</SectionHeader>
      <SectionHeader variant="default" as="h4">Default Variant (h4)</SectionHeader>
      <SectionHeader variant="muted" as="h3">Muted Variant</SectionHeader>
    </div>
  )
}
