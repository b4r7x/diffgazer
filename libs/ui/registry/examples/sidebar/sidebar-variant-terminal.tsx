import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarItemBadge,
  SidebarItemLabel,
  SidebarSection,
  SidebarSectionTitle,
} from "@/components/ui/sidebar";

export default function SidebarVariantTerminal() {
  return (
    <Sidebar variant="terminal" className="h-full">
      <SidebarHeader>
        <span className="text-xs font-mono text-muted-foreground">~/ui/docs</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>getting-started</SidebarSectionTitle>
          <SidebarItem>install</SidebarItem>
          <SidebarItem>quickstart</SidebarItem>
          <SidebarItem>theming</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>primitives</SidebarSectionTitle>
          <SidebarItem>dialog</SidebarItem>
          <SidebarItem active>toggle-group</SidebarItem>
          <SidebarItem>
            <SidebarItemLabel>stepper</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">new</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem disabled>sidebar</SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>cli</SidebarSectionTitle>
          <SidebarItem>add</SidebarItem>
          <SidebarItem>remove</SidebarItem>
          <SidebarItem>diff</SidebarItem>
        </SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}
