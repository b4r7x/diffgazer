import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
    code: string;
    language?: string;
    showLineNumbers?: boolean;
}

const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
    ({ className, code, language, showLineNumbers = true, ...props }, ref) => {
        const lines = code.split('\n');

        return (
            <div
                ref={ref}
                className={cn(
                    'overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm',
                    className
                )}
                {...props}
            >
                <div className="min-w-fit">
                    {lines.map((line, index) => {
                        const isAddition = line.startsWith('+');
                        const isDeletion = line.startsWith('-');
                        const lineNumber = index + 1;

                        return (
                            <div
                                key={index}
                                className={cn(
                                    'flex',
                                    isAddition && 'bg-green-500/20 text-green-300',
                                    isDeletion && 'bg-red-500/20 text-red-300'
                                )}
                            >
                                {showLineNumbers && (
                                    <span className="mr-4 w-8 shrink-0 select-none text-right text-muted-foreground opacity-50">
                                        {lineNumber}
                                    </span>
                                )}
                                <span className="whitespace-pre">{line}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);
CodeBlock.displayName = 'CodeBlock';

export { CodeBlock };
