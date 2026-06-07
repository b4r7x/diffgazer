import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemLabel,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@/components/ui/sidebar";

// `block` variant — items use a soft fill on active rather than the `▸` glyph
// prefix; the section title's own chevron (▾/▸) is the single disclosure cue
// per group, avoiding double-decoration. Items wrapped in
// `<SidebarSectionContent>` are the only ones that honor the section's open
// state — items rendered outside that wrapper stay visible regardless.
export default function SidebarCollapsible() {
  return (
    <Sidebar variant="block" className="h-full">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">File Browser</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>src/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem active>index.ts</SidebarItem>
            <SidebarItem>utils.ts</SidebarItem>
            <SidebarItem>config.ts</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen={false}>
          <SidebarSectionTitle>tests/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem>index.test.ts</SidebarItem>
            <SidebarItem>utils.test.ts</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>docs/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem>
              <SidebarItemLabel>README.md</SidebarItemLabel>
              <SidebarItemBadge>
                <span className="text-xs text-muted-foreground">draft</span>
              </SidebarItemBadge>
            </SidebarItem>
            <SidebarItem>CHANGELOG.md</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">3 sections</span>
      </SidebarFooter>
    </Sidebar>
  );
}
