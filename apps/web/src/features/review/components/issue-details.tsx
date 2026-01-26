// import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/ui/code-block';
import type { TriageIssue } from '@repo/schemas';

export interface IssueDetailsProps {
    issue: TriageIssue | null;
    onApplyPatch?: (id: string) => void;
    onExplain?: (id: string) => void;
    className?: string;
}

export function IssueDetails({ issue, onApplyPatch, onExplain, className }: IssueDetailsProps) {
    if (!issue) {
        return (
            <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
                Select an issue to view details
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full overflow-hidden bg-background", className)}>
            {/* Header */}
            <div className="p-6 border-b border-border space-y-4 flex-shrink-0">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold tracking-tight">{issue.title}</h2>
                        <div className="font-mono text-sm text-muted-foreground flex items-center space-x-2">
                            <span>{issue.file}</span>
                            <span className="text-muted-foreground/50">:</span>
                            <span className="text-foreground">{issue.line_start}-{issue.line_end}</span>
                        </div>
                    </div>
                    <Badge variant={issue.severity} className="uppercase text-xs tracking-wider px-2 py-1">
                        {issue.severity}
                    </Badge>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    {issue.suggested_patch && (
                        <Button size="sm" onClick={() => onApplyPatch?.(issue.id)}>
                            Apply Patch
                        </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => onExplain?.(issue.id)}>
                        Explain
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <Tabs defaultValue="details" className="h-full flex flex-col">
                    <div className="px-6 border-b border-border bg-muted/20">
                        <TabsList className="bg-transparent p-0 h-10 space-x-4">
                            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent px-0 py-2 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent">
                                Details
                            </TabsTrigger>
                            <TabsTrigger value="explain" className="rounded-none border-b-2 border-transparent px-0 py-2 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent">
                                Explain
                            </TabsTrigger>
                            {issue.suggested_patch && (
                                <TabsTrigger value="patch" className="rounded-none border-b-2 border-transparent px-0 py-2 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent">
                                    Patch
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="trace" className="rounded-none border-b-2 border-transparent px-0 py-2 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent">
                                Trace
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <TabsContent value="details" className="mt-0 space-y-6">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p>{issue.rationale}</p>
                            </div>

                            {/* Assuming code context is not directly in standard TriageIssue properties unless verified, 
                                checking schema: TriageIssue has no 'code_context'. Evidence has 'excerpt'.
                                We might need to map evidence to code context or hide it.
                                Let's hide it if not present.
                            */}
                            {/* {issue.code_context && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">Code Context</h3>
                                    <CodeBlock
                                        code={issue.code_context}
                                        className="border border-border"
                                    />
                                </div>
                            )} */}
                        </TabsContent>

                        <TabsContent value="explain" className="mt-0">
                            <div className="prose prose-sm dark:prose-invert">
                                <p>Explanation AI insights placeholder...</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="patch" className="mt-0">
                            {issue.suggested_patch ? (
                                <CodeBlock code={issue.suggested_patch} />
                            ) : (
                                <div className="text-muted-foreground italic">No patch available</div>
                            )}
                        </TabsContent>

                        <TabsContent value="trace" className="mt-0">
                            <div className="text-muted-foreground italic">Trace view placeholder...</div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
