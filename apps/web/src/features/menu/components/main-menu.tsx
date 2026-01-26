// import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { cn } from '@/lib/utils';

// ASCII art simulation for "Stargazer" if desired, or just text.
// The task says:
//         ⭐ stargazer
//     AI-powered code review
// [Status Card]
// Actions: ...

export interface MainMenuProps {
    provider?: string;
    model?: string;
    lastReviewAt?: string;
    hasLastReview?: boolean;
    onAction?: (action: string) => void;
}

export function MainMenu({
    provider = 'anthropic',
    model = 'sonnet',
    lastReviewAt = '2 hours ago',
    onAction,
}: MainMenuProps) {
    const actions = [
        { label: 'Review unstaged changes', key: 'r', action: 'review-unstaged' },
        { label: 'Review staged changes', key: 'R', action: 'review-staged' },
        { label: 'Review specific files...', key: 'f', action: 'review-files' },
        { label: 'Resume last review', key: 'l', action: 'resume-review' },
        { label: 'History', key: 'h', action: 'history' },
        { label: 'Settings', key: 's', action: 'settings' },
    ];

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 space-y-12 animate-fade-in">
            {/* Title & Logo */}
            <div className="text-center space-y-2">
                <div className="flex items-center justify-center space-x-3 text-4xl font-bold tracking-tighter">
                    <span>⭐</span>
                    <span className="text-primary bg-clip-text">stargazer</span>
                </div>
                <p className="text-muted-foreground text-lg">AI-powered code review</p>
            </div>

            {/* Status Card */}
            <Card className="w-full max-w-md bg-secondary/50 border-muted">
                <CardContent className="p-6 space-y-2 font-mono text-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Provider:</span>
                        <div className="flex items-center space-x-2">
                            <span className="text-primary">{provider}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-foreground">{model}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Last review:</span>
                        <span className="text-foreground">{lastReviewAt}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="w-full max-w-md space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">Actions</h2>
                <div className="space-y-2">
                    {actions.map((item) => (
                        <Button
                            key={item.key}
                            variant="ghost"
                            className="w-full justify-start h-auto py-3 px-4 font-normal text-base hover:bg-secondary/80 group"
                            onClick={() => onAction?.(item.action)}
                        >
                            <Badge variant="secondary" className="mr-4 w-8 justify-center font-mono text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                [{item.key}]
                            </Badge>
                            <span className="text-foreground group-hover:text-primary transition-colors">{item.label}</span>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
