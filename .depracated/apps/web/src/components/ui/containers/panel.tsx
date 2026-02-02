import { cn } from '../../../lib/utils';

export interface PanelProps {
  children: React.ReactNode;
  className?: string;
  borderless?: boolean;
}

export interface PanelHeaderProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle' | 'floating' | 'badge' | 'section' | 'section-bordered';
  value?: React.ReactNode;
  valueVariant?: 'default' | 'success' | 'success-badge' | 'muted';
}

export interface PanelContentProps {
  children: React.ReactNode;
  className?: string;
  spacing?: 'none' | 'sm' | 'md';
}

export interface PanelDividerProps {
  className?: string;
}

const spacingClasses: Record<NonNullable<PanelContentProps['spacing']>, string> = {
  none: '',
  sm: 'space-y-2',
  md: 'space-y-4',
};

const headerVariants = {
  default: 'bg-tui-selection text-gray-400 text-xs px-3 py-1 border-b border-tui-border font-bold uppercase tracking-wider',
  subtle: 'bg-tui-selection/30 text-gray-500 text-xs p-2 border-b border-tui-border uppercase tracking-widest text-center',
  floating: 'absolute -top-3 left-4 bg-tui-bg px-2 text-xs text-tui-blue font-bold',
  badge: 'absolute -top-3 left-4 bg-tui-bg px-2 py-0.5 text-xs font-bold',
  'section': 'text-gray-500 font-bold uppercase text-xs tracking-wider mb-4',
  'section-bordered': 'text-gray-500 font-bold uppercase text-xs tracking-wider border-b border-tui-border pb-2 mb-2',
};

function getValueClasses(valueVariant: PanelHeaderProps['valueVariant'] = 'default') {
  if (valueVariant === 'success-badge') {
    return 'bg-tui-green/10 text-tui-green border border-tui-green px-2 py-0.5 text-xs font-bold tracking-wider rounded-sm';
  }
  if (valueVariant === 'success') return 'text-tui-green';
  if (valueVariant === 'muted') return 'text-gray-500';
  return 'text-gray-400';
}

function PanelHeader({ children, className, variant = 'default', value, valueVariant = 'default' }: PanelHeaderProps) {
  const baseClasses = headerVariants[variant];

  if (value !== undefined) {
    return (
      <div className={cn(baseClasses, 'flex items-center justify-between', className)}>
        <span>{children}</span>
        <span className={getValueClasses(valueVariant)}>{value}</span>
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, className)}>
      {children}
    </div>
  );
}

function PanelContent({ children, className, spacing = 'md' }: PanelContentProps) {
  return (
    <div className={cn('p-4 text-sm', spacingClasses[spacing], className)}>
      {children}
    </div>
  );
}

function PanelDivider({ className }: PanelDividerProps) {
  return (
    <div className={cn('my-1 border-t border-tui-border mx-4 opacity-50', className)} />
  );
}

function PanelRoot({ children, className, borderless }: PanelProps) {
  return (
    <div className={cn('relative', !borderless && 'border border-tui-border', className)}>
      {children}
    </div>
  );
}

export const Panel = PanelRoot;
export { PanelHeader, PanelContent, PanelDivider };
