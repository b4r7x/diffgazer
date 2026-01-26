import { Link, useLocation } from '@tanstack/react-router';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
// Remove React import

export function Header() {
    const location = useLocation();
    const currentPath = location.pathname;

    const isActive = (path: string) => {
        if (path === '/' && currentPath === '/') return true;
        if (path !== '/' && currentPath.startsWith(path)) return true;
        return false;
    };

    const navItems = [
        { label: 'Menu', path: '/' },
        { label: 'Review', path: '/review' },
        { label: 'History', path: '/history' },
        { label: 'Settings', path: '/settings' },
    ];

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
            <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2 font-semibold tracking-tight">
                    <span>⭐</span>
                    <span className="text-primary">stargazer</span>
                </div>

                <nav className="flex items-center space-x-6 text-sm font-medium">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={cn(
                                'transition-colors hover:text-foreground/80',
                                isActive(item.path) ? 'text-foreground' : 'text-foreground/60'
                            )}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="flex items-center space-x-4">
                <span className="text-xs text-muted-foreground mr-2 hidden md:inline-block">
                    Gemini 3 Pro
                </span>
                <Badge variant="outline" className="text-xs font-normal">
                    anthropic / sonnet
                </Badge>
            </div>
        </header>
    );
}
