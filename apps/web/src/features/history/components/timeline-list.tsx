import type { TimelineItem } from "@diffgazer/core/schemas/presentation";
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
  const handleSelect = (id: string | null) => {
    if (id === null) return;
    onSelect(id);
  };

  const getCountDescription = (count: number) => (
    `${count} ${count === 1 ? "review" : "reviews"}`
  );

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
      onSelect={handleSelect}
      onHighlightChange={handleSelect}
      onNavigationBoundaryReached={(direction) => {
        onBoundaryReached?.(toVerticalBoundaryDirection(direction));
      }}
      focused={keyboardEnabled}
      wrap={false}
      autoFocus={keyboardEnabled}
      className={className}
    >
      {items.map((item) => (
        <NavigationList.Item
          key={item.id}
          id={item.id}
          density="compact"
          className="border-b border-tui-border last:border-b-0"
        >
          <NavigationList.Title>{item.label}</NavigationList.Title>
          <NavigationList.Status>{item.count}</NavigationList.Status>
          <NavigationList.Meta className="sr-only">
            {getCountDescription(item.count)}
          </NavigationList.Meta>
        </NavigationList.Item>
      ))}
    </NavigationList>
  );
}
