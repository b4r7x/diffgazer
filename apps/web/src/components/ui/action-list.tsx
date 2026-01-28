'use client';

import {
  createContext,
  useContext,
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';
import { useKey, useSelectableList } from '@/hooks/keyboard';

interface ActionListItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface ActionListProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  wrap?: boolean;
  onBoundaryReached?: (direction: 'up' | 'down') => void;
  onActivate: (item: ActionListItemData) => void;
}

interface ActionListItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  description?: ReactNode;
  className?: string;
}

interface ActionListContextValue {
  focusedIndex: number;
  items: ActionListItemData[];
  onActivate: (item: ActionListItemData) => void;
  disabled?: boolean;
}

const ActionListContext = createContext<ActionListContextValue | null>(null);

function useActionListContext() {
  const context = useContext(ActionListContext);
  if (!context) {
    throw new Error('ActionList.Item must be used within ActionList');
  }
  return context;
}

function ActionListItem({
  id,
  disabled = false,
  children,
  description,
  className,
}: ActionListItemProps) {
  const { focusedIndex, items, onActivate, disabled: listDisabled } = useActionListContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isFocused = itemData.index === focusedIndex;
  const isDisabled = disabled || listDisabled;

  const handleClick = () => {
    if (isDisabled) return;
    onActivate(itemData);
  };

  return (
    <div
      role="option"
      aria-selected={isFocused}
      aria-disabled={isDisabled}
      onClick={handleClick}
      className={cn(
        'px-4 py-2 flex items-start cursor-pointer font-mono w-full',
        isFocused && 'bg-tui-selection text-white font-bold',
        !isFocused && 'text-tui-fg hover:bg-tui-selection/50',
        isDisabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex flex-col min-w-0">
        <span>{children}</span>
        {description && (
          <span className={cn('text-sm mt-0.5', isFocused ? 'text-white/70' : 'text-tui-muted')}>
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionListRoot({
  children,
  className,
  disabled,
  wrap = true,
  onBoundaryReached,
  onActivate,
}: ActionListProps) {
  const items: ActionListItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems((child.props as { children?: ReactNode }).children);
      } else if (child.type === ActionListItem) {
        const childProps = child.props as ActionListItemProps;
        items.push({
          id: childProps.id,
          disabled: childProps.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  extractItems(children);

  const getDisabled = (index: number) => items[index]?.disabled ?? false;

  const { focusedIndex } = useSelectableList({
    itemCount: items.length,
    getDisabled,
    wrap,
    onBoundaryReached,
    enabled: !disabled && items.length > 0,
  });

  const handleActivate = () => {
    const item = items[focusedIndex];
    if (!item || item.disabled || disabled) return;
    onActivate(item);
  };

  useKey('Enter', handleActivate, { enabled: !disabled });
  useKey(' ', handleActivate, { enabled: !disabled });

  const contextValue: ActionListContextValue = {
    focusedIndex,
    items,
    onActivate,
    disabled,
  };

  return (
    <ActionListContext.Provider value={contextValue}>
      <div role="listbox" className={cn('w-full', className)}>
        {children}
      </div>
    </ActionListContext.Provider>
  );
}

export const ActionList = Object.assign(ActionListRoot, {
  Item: ActionListItem,
});

export type { ActionListProps, ActionListItemProps, ActionListItemData, ActionListContextValue };
