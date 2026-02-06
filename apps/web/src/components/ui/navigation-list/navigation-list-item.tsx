import { type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useNavigationListContext } from './navigation-list-context';

export interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  badge?: ReactNode;
  statusIndicator?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function NavigationListItem({
  id,
  disabled = false,
  badge,
  statusIndicator,
  subtitle,
  children,
  className,
}: NavigationListItemProps) {
  const { selectedId, onSelect, onActivate, isFocused } = useNavigationListContext();
  const isSelected = selectedId === id;
  const showSelection = isSelected && isFocused;

  const handleClick = () => {
    if (!disabled) {
      onSelect(id);
      onActivate?.(id);
    }
  };

  return (
    <div
      id={`navlist-${id}`}
      role="option"
      data-value={id}
      aria-selected={isSelected}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex cursor-pointer group',
        showSelection && 'bg-tui-fg text-black',
        !showSelection && 'hover:bg-tui-selection border-b border-tui-border/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div
        className={cn(
          'w-1 shrink-0',
          showSelection ? 'bg-tui-blue' : 'bg-transparent group-hover:bg-tui-muted'
        )}
      />
      <div className="flex-1 p-3">
        <div className="flex justify-between items-start mb-1">
          <span className={cn('font-bold flex items-center', showSelection && 'text-black')}>
            <span className={cn('mr-2', !showSelection && 'opacity-0')}>▌</span>
            {children}
          </span>
          {statusIndicator && (
            <span className={cn('text-[10px] font-bold', showSelection ? 'text-black' : 'text-tui-yellow')}>
              {statusIndicator}
            </span>
          )}
        </div>
        {(badge || subtitle) && (
          <div className="flex gap-2 items-center">
            {badge}
            {subtitle && (
              <span className={cn('text-[9px]', showSelection ? 'text-black/70' : 'text-tui-muted')}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
