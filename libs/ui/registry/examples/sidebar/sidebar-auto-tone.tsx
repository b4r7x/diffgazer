import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarSection,
  SidebarSectionTitle,
  SidebarItem,
  SidebarItemLabel,
  SidebarItemBadge,
} from "@/components/ui/sidebar"

/**
 * Demonstrates `autoTone`: each item's intent dot color is derived from its
 * `value` via the built-in dictionary (passed → success, running → info,
 * pending → neutral, etc.). Because each row's `value` must also be unique
 * (it's the keyboard-nav identifier exposed as `data-value`), the demo uses
 * row-specific values and supplies an explicit `intent` per item so the
 * status semantics stay attached to the row, not the id. The last entry
 * overrides resolution with `intent="danger"`. Color is decoration only —
 * the badge text carries the same meaning for assistive tech.
 */
export default function SidebarAutoTone() {
  return (
    <Sidebar autoTone variant="bar" className="w-72 h-80 border border-border bg-background">
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
  )
}
