import { cn } from '../../lib/utils';

export interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export interface PanelHeaderProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'subtle';
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
};

function PanelHeader({ children, className, variant = 'default' }: PanelHeaderProps) {
  return (
    <div className={cn(headerVariants[variant], className)}>
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

function PanelRoot({ children, className }: PanelProps) {
  return (
    <div className={cn('border border-tui-border', className)}>
      {children}
    </div>
  );
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Content: PanelContent,
  Divider: PanelDivider,
});
