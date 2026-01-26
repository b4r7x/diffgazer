import { useEffect } from 'react';
import { useSessions } from '@/features/sessions/hooks/use-sessions';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

export default function SessionsPage() {
    const { sessions, isLoading, error, refresh, deleteSession } = useSessions();

    useEffect(() => {
        refresh();
    }, [refresh]);

    if (isLoading && !sessions.length) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full flex-col items-center justify-center space-y-4">
                <p className="text-destructive">Failed to load sessions</p>
                <Button onClick={refresh}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="container py-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Sessions</h1>
                <Button variant="outline" onClick={refresh} disabled={isLoading}>
                    Refresh
                </Button>
            </div>

            {sessions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No active sessions found.
                </div>
            ) : (
                <div className="grid gap-4">
                    {sessions.map((session) => (
                        <Card key={session.id}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="space-y-1">
                                    <CardTitle className="text-base font-medium">
                                        Session {session.id.slice(0, 8)}
                                    </CardTitle>
                                    <CardDescription>
                                        Started {format(new Date(session.createdAt), 'PPpp')}
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => deleteSession(session.id)}
                                >
                                    Delete
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground">
                                    Messages: <span className="text-foreground">{session.messageCount}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
