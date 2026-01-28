'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { useScope, useKey } from '@/hooks/keyboard';
import { Button } from './button';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
    useScope('modal');
    useKey('Escape', onClose, { enabled: isOpen });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                className={cn(
                    'relative w-full max-w-4xl max-h-[90vh] flex flex-col',
                    'bg-[--tui-bg] text-[--tui-fg]',
                    'border-[6px] border-double border-[--tui-fg]',
                    'shadow-[0_0_0_1px_var(--tui-border),0_30px_60px_-12px_rgba(0,0,0,0.9)]',
                    className
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tui-modal-title"
            >
                <div className="flex justify-between items-center py-2 px-4 border-b-2 border-[--tui-border] bg-[--tui-bg] shrink-0">
                    <h2 id="tui-modal-title" className="font-bold text-sm">
                        {title}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        [x]
                    </Button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
