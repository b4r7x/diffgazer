import { useEffect, useRef } from "react";
import { NavigationList } from "@diffgazer/ui/components/navigation-list";
import type { TimelineItem } from "@diffgazer/core/schemas/ui";
import { toVerticalBoundaryDirection } from "@/lib/vertical-navigation";

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
  const lastNotifiedId = useRef<string | null>(selectedId);

  useEffect(() => {
    lastNotifiedId.current = selectedId;
  }, [selectedId]);

  const notifySelect = (id: string) => {
    if (lastNotifiedId.current === id) return;
    lastNotifiedId.current = id;
    onSelect(id);
  };

  const getCountDescription = (count: number) => (
    `${count} ${count === 1 ? "review" : "reviews"}`
  );

  return (
    <NavigationList
      aria-label="Review sections"
      onFocus={onFocus}
      selectedId={selectedId}
      highlightedId={keyboardEnabled ? selectedId : null}
      onSelect={notifySelect}
      onHighlightChange={notifySelect}
      onNavigationBoundaryReached={(direction) => {
        onBoundaryReached?.(toVerticalBoundaryDirection(direction));
      }}
      focused={keyboardEnabled}
      wrap={false}
      autoFocus={keyboardEnabled}
      className={className}
    >
      {items.map((item) => (
        <NavigationList.Item key={item.id} id={item.id} density="compact">
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
