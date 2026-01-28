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
import { useKey, useKeys } from '@/hooks/keyboard';

interface MenuItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: MenuItemData) => void;
  items: MenuItemData[];
  variant: 'default' | 'hub';
}

interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  hotkey?: number | string;
  value?: ReactNode;
  valueVariant?: 'default' | 'success' | 'success-badge' | 'muted';
  children: ReactNode;
  className?: string;
}

interface MenuRootProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: { id: string; disabled: boolean; index: number }) => void;
  keyboardEnabled?: boolean;
  enableNumberJump?: boolean;
  variant?: 'default' | 'hub';
  className?: string;
  children: ReactNode;
}

interface MenuDividerProps {
  className?: string;
}

interface MenuHeaderProps {
  children: ReactNode;
  className?: string;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu.Item must be used within Menu');
  }
  return context;
}

function MenuItem({
  id,
  disabled = false,
  variant = 'default',
  hotkey,
  value,
  valueVariant = 'default',
  children,
  className,
}: MenuItemProps) {
  const { selectedIndex, onSelect, onActivate, items, variant: menuVariant } = useMenuContext();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;
  const isDanger = variant === 'danger';
  const isHub = menuVariant === 'hub';

  const handleClick = () => {
    if (!disabled) {
      onSelect(itemData.index);
      onActivate?.(itemData);
    }
  };

  const selectedBg = isDanger ? 'bg-tui-red' : 'bg-tui-blue';

  const baseClasses = isHub
    ? 'px-4 py-4 flex justify-between items-center cursor-pointer text-sm w-full border-b border-tui-border last:border-b-0'
    : 'px-4 py-3 flex items-center cursor-pointer font-mono w-full';

  const stateClasses = isSelected
    ? cn(selectedBg, 'text-black font-bold', isHub && 'shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]')
    : cn(
        isHub ? 'text-tui-fg' : (isDanger ? 'text-tui-red' : 'text-tui-fg'),
        'hover:bg-tui-selection group transition-colors',
        !isHub && 'duration-75'
      );

  const getValueClasses = () => {
    if (isSelected) return 'font-mono text-xs uppercase tracking-wide';
    if (valueVariant === 'success-badge') {
      return 'text-tui-green font-mono text-xs border border-tui-green/30 bg-tui-green/10 px-2 py-0.5 rounded';
    }
    if (valueVariant === 'success') return 'text-tui-violet font-mono text-xs';
    return 'text-gray-500 font-mono text-xs';
  };

  const indicatorColor = isDanger ? 'text-tui-red' : 'text-tui-blue';

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(baseClasses, stateClasses, disabled && 'opacity-50 cursor-not-allowed', className)}
    >
      {isHub ? (
        <>
          <div className="flex items-center">
            <span className={cn('w-6', isSelected ? 'text-black' : 'text-tui-blue opacity-0 group-hover:opacity-100 transition-opacity')}>
              {isSelected ? '▌' : '❯'}
            </span>
            <span className={cn(isSelected ? '' : 'font-medium group-hover:text-white')}>{children}</span>
          </div>
          {value && <div className={getValueClasses()}>{value}</div>}
        </>
      ) : (
        <>
          <span className={cn('mr-3 shrink-0', !isSelected && cn('opacity-0 group-hover:opacity-100', indicatorColor))}>▌</span>
          {hotkey !== undefined && (
            <span className={cn('mr-4 shrink-0', !isSelected && cn('group-hover:text-tui-fg', indicatorColor))}>[{hotkey}]</span>
          )}
          <span className={cn(!isHub && 'tracking-wide', !isSelected && !isDanger && 'group-hover:text-white')}>{children}</span>
        </>
      )}
    </div>
  );
}

function MenuDivider({ className }: MenuDividerProps) {
  return <div className={cn('my-1 border-t border-tui-border mx-4 opacity-50', className)} />;
}

function MenuHeader({ children, className }: MenuHeaderProps) {
  return (
    <div className={cn('absolute -top-3 left-4', className)}>
      <span className="inline-block border border-tui-blue bg-tui-bg px-2 py-0.5 text-tui-blue font-bold text-xs uppercase tracking-wider">
        {children}
      </span>
    </div>
  );
}

function MenuRoot({
  selectedIndex,
  onSelect,
  onActivate,
  keyboardEnabled = true,
  enableNumberJump = false,
  variant = 'default',
  className,
  children,
}: MenuRootProps) {
  const items: MenuItemData[] = [];
  let itemIndex = 0;

  function extractItems(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        extractItems((child.props as { children?: ReactNode }).children);
      } else if (child.type === MenuItem) {
        const props = child.props as MenuItemProps;
        items.push({
          id: props.id,
          disabled: props.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  extractItems(children);

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    let index = start + direction;
    while (index >= 0 && index < items.length) {
      if (!items[index]?.disabled) return index;
      index += direction;
    }
    return start;
  };

  useKey('ArrowUp', () => {
    const newIndex = findNextIndex(selectedIndex, -1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled });

  useKey('ArrowDown', () => {
    const newIndex = findNextIndex(selectedIndex, 1);
    if (newIndex !== selectedIndex) onSelect(newIndex);
  }, { enabled: keyboardEnabled });

  useKey('Enter', () => {
    const item = items[selectedIndex];
    if (item && !item.disabled) onActivate?.(item);
  }, { enabled: keyboardEnabled });

  const NUMBER_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

  useKeys(NUMBER_KEYS, (key) => {
    const index = parseInt(key, 10) - 1;
    const item = items[index];
    if (item && !item.disabled) {
      onSelect(index);
      onActivate?.(item);
    }
  }, { enabled: keyboardEnabled && enableNumberJump });

  const contextValue: MenuContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
    variant,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <div role="listbox" className={cn('w-full relative', className)}>
        {children}
      </div>
    </MenuContext.Provider>
  );
}

export const Menu = MenuRoot;
export { MenuItem, MenuDivider, MenuHeader };

export type { MenuRootProps, MenuItemProps, MenuDividerProps, MenuHeaderProps, MenuItemData };
