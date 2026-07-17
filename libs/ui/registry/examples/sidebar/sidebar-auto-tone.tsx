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

/**
 * Demonstrates `autoTone` with explicit intents. Each row keeps a unique navigation `value`, while
 * `intent` supplies the status dot independently of that identifier and takes precedence over the
 * built-in value dictionary. Color is decoration only; the badge text carries the same meaning for
 * assistive tech.
 */
export default function SidebarAutoTone() {
  return (
    <Sidebar autoTone variant="bar" className="h-full">
      <SidebarHeader>
        <span className="text-xs font-mono text-muted-foreground">~/ci/pipeline</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection>
          <SidebarSectionTitle>build</SidebarSectionTitle>
          <SidebarItem value="lint" intent="success">
            <SidebarItemLabel>lint</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">passed</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem value="typecheck" intent="success">
            <SidebarItemLabel>typecheck</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">passed</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem active value="compile" intent="success">
            <SidebarItemLabel>compile</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">passed</span>
            </SidebarItemBadge>
          </SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>test</SidebarSectionTitle>
          <SidebarItem value="unit" intent="warning">
            <SidebarItemLabel>unit</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">3 warn</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem value="integration" intent="danger">
            <SidebarItemLabel>integration</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">1 fail</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem value="e2e" intent="info">
            <SidebarItemLabel>e2e</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">running</span>
            </SidebarItemBadge>
          </SidebarItem>
        </SidebarSection>
        <SidebarSection>
          <SidebarSectionTitle>deploy</SidebarSectionTitle>
          <SidebarItem value="preview" intent="neutral">
            <SidebarItemLabel>preview</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">pending</span>
            </SidebarItemBadge>
          </SidebarItem>
          <SidebarItem value="production" intent="danger">
            <SidebarItemLabel>production</SidebarItemLabel>
            <SidebarItemBadge>
              <span className="text-xs text-muted-foreground">blocked</span>
            </SidebarItemBadge>
          </SidebarItem>
        </SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}
