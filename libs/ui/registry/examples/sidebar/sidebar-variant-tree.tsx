import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
  SidebarSectionContent,
  SidebarSectionTitle,
} from "@/components/ui/sidebar";

export default function SidebarVariantTree() {
  return (
    <Sidebar variant="tree" className="h-full">
      <SidebarHeader>
        <span className="text-xs font-mono text-muted-foreground">[ 01 / FS_TREE ]</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>diffgazer</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem>Overview</SidebarItem>
            <SidebarItem>CLI Setup</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>@diffgazer/ui</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem active>Getting Started</SidebarItem>
            <SidebarItem>Components (47)</SidebarItem>
            <SidebarItem>Hooks (11)</SidebarItem>
            <SidebarItem>Theme Config</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
        <SidebarSection collapsible defaultOpen>
          <SidebarSectionTitle>@diffgazer/keys</SidebarSectionTitle>
          <SidebarSectionContent>
            <SidebarItem>Core Concepts</SidebarItem>
            <SidebarItem>Focus Management</SidebarItem>
            <SidebarItem>Shortcuts</SidebarItem>
          </SidebarSectionContent>
        </SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}
