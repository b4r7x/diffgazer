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

// `bar` variant — items use a soft fill plus a 2px left edge on active rather
// than the chevron marker prefix; the section title's own chevron is the
// single disclosure cue per group, avoiding double-decoration. Items wrapped
// in `<SidebarSectionContent>` are the only ones that honor the section's
// open state — items rendered outside that wrapper stay visible regardless.
export default function SidebarCollapsible() {
  return (
    <Sidebar variant="bar" className="h-full">
      <SidebarHeader>
        <span className="text-sm font-mono font-bold">File Browser</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>src/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem active href="#src-index">
              index.ts
            </SidebarItem>
            <SidebarItem href="#src-utils">utils.ts</SidebarItem>
            <SidebarItem href="#src-config">config.ts</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen={false}>
          <SidebarSectionTitle>tests/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem href="#tests-index">index.test.ts</SidebarItem>
            <SidebarItem href="#tests-utils">utils.test.ts</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>docs/</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem href="#docs-readme">
              <SidebarItemLabel>README.md</SidebarItemLabel>
              <SidebarItemBadge>
                <span className="text-xs text-muted-foreground">draft</span>
              </SidebarItemBadge>
            </SidebarItem>
            <SidebarItem href="#docs-changelog">CHANGELOG.md</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
      </SidebarContent>
      <SidebarFooter>
        <span className="text-xs text-muted-foreground font-mono">3 sections</span>
      </SidebarFooter>
    </Sidebar>
  );
}
