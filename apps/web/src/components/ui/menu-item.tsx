import { cn } from '../../lib/utils';

export interface MenuItemProps {
  label: string;
  hotkey?: number | string;
  isSelected?: boolean;
  isDisabled?: boolean;
  variant?: 'default' | 'danger';
  onClick?: () => void;
}

export function MenuItem({
  label,
  hotkey,
  isSelected = false,
  isDisabled = false,
  variant = 'default',
  onClick,
}: MenuItemProps) {
  const baseClasses = 'px-4 py-3 flex items-center cursor-pointer font-mono w-full';
  const disabledClasses = isDisabled && 'opacity-50 cursor-not-allowed';
  const isDanger = variant === 'danger';

  if (isSelected) {
    const selectedBg = isDanger ? 'bg-tui-red' : 'bg-tui-blue';
    return (
      <div
        onClick={() => !isDisabled && onClick?.()}
        className={cn(baseClasses, selectedBg, 'text-black font-bold', disabledClasses)}
      >
        <span className="mr-3 shrink-0">▌</span>
        {hotkey !== undefined && <span className="mr-4 shrink-0">[{hotkey}]</span>}
        <span className="tracking-wide">{label}</span>
      </div>
    );
  }

  const textColor = isDanger ? 'text-tui-red' : 'text-tui-fg';
  const indicatorColor = isDanger ? 'text-tui-red' : 'text-tui-blue';

  return (
    <div
      onClick={() => !isDisabled && onClick?.()}
      className={cn(baseClasses, textColor, 'hover:bg-tui-selection group transition-colors duration-75', disabledClasses)}
    >
      <span className={cn('mr-3 shrink-0 opacity-0 group-hover:opacity-100', indicatorColor)}>▌</span>
      {hotkey !== undefined && (
        <span className={cn('mr-4 shrink-0 group-hover:text-tui-fg', indicatorColor)}>[{hotkey}]</span>
      )}
      <span className={cn('tracking-wide', !isDanger && 'group-hover:text-white')}>{label}</span>
    </div>
  );
}
