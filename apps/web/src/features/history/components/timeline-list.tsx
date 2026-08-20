import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
import { pluralize } from "@diffgazer/core/strings";
import { isListNavigationKey, toVerticalBoundaryDirection } from "@diffgazer/keys";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";

export interface TimelineListProps {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFocus?: () => void;
  keyboardEnabled?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  className?: string;
}

export function TimelineList({
  items,
  selectedId,
  onSelect,
  onFocus,
  keyboardEnabled = true,
  onBoundaryReached,
  className,
}: TimelineListProps) {
  const handleHighlightChange = (id: string | null) => {
    if (id === null) return;
    onSelect(id);
  };

  return (
    <NavigationList
      aria-label="Review sections"
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (!keyboardEnabled && isListNavigationKey(event.key)) {
          event.preventDefault();
        }
      }}
      selectedId={selectedId}
      highlighted={keyboardEnabled ? selectedId : null}
      onHighlightChange={handleHighlightChange}
      onNavigationBoundaryReached={(direction) => {
        onBoundaryReached?.(toVerticalBoundaryDirection(direction));
      }}
      focused={keyboardEnabled}
      wrap={false}
      // "/", l, and R are window-level shortcuts for this zone; list typeahead
      // would claim those keystrokes before they arrive.
      typeahead={false}
      autoFocus={keyboardEnabled}
      className={className}
    >
      {items.map((item) => (
        <NavigationList.Item
          key={item.id}
          id={item.id}
          density="compact"
          className="border-b border-border last:border-b-0"
        >
          <NavigationList.Title>{item.label}</NavigationList.Title>
          {/* The list is full-bleed, so the count keeps its own clearance from
              the pane's right frame. Amber is the rail's one hierarchy accent;
              the primitive's highlight rule still repaints it. */}
          <NavigationList.Status className="pr-0.5 text-warning-text">
            {item.count}
          </NavigationList.Status>
          <NavigationList.Meta className="sr-only">
            {pluralize(item.count, "run")}
          </NavigationList.Meta>
        </NavigationList.Item>
      ))}
    </NavigationList>
  );
}
