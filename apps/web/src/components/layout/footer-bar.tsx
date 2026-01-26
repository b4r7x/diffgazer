export function FooterBar() {
    return (
        <div className="flex h-8 items-center border-t border-border bg-muted px-4 text-xs font-medium text-muted-foreground">
            <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1 hover:text-foreground">
                    <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] shadow-sm">
                        r
                    </kbd>
                    <span>review</span>
                </span>
                <span className="flex items-center space-x-1 hover:text-foreground">
                    <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] shadow-sm">
                        h
                    </kbd>
                    <span>history</span>
                </span>
                <span className="flex items-center space-x-1 hover:text-foreground">
                    <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] shadow-sm">
                        s
                    </kbd>
                    <span>settings</span>
                </span>
                <span className="flex items-center space-x-1 hover:text-foreground">
                    <kbd className="rounded bg-background px-1 py-0.5 font-mono text-[10px] shadow-sm">
                        ?
                    </kbd>
                    <span>help</span>
                </span>
            </div>
        </div>
    );
}
