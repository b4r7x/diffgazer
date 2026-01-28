'use client';

import * as React from 'react';
import { Modal } from '@/components/ui/modal';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScope, useKey } from '@/hooks/keyboard';

export interface TrustCapabilities {
    readFiles: boolean;
    readGit: boolean;
    runCommands: boolean;
}

export interface TrustPromptModalProps {
    isOpen: boolean;
    directory: string;
    onConfirm: (capabilities: TrustCapabilities) => void;
    onCancel: () => void;
}

type TrustMode = 'session' | 'persistent';

const CHECKBOX_ITEMS = [
    { key: 'readFiles', label: 'Allow reading repository files' },
    { key: 'readGit', label: 'Allow reading git metadata' },
    { key: 'runCommands', label: 'Allow running commands (tests/lint)' },
] as const;

export function TrustPromptModal({
    isOpen,
    directory,
    onConfirm,
    onCancel,
}: TrustPromptModalProps) {
    const [capabilities, setCapabilities] = React.useState<TrustCapabilities>({
        readFiles: true,
        readGit: true,
        runCommands: false,
    });
    const [focusedIndex, setFocusedIndex] = React.useState(2);
    const [trustMode, setTrustMode] = React.useState<TrustMode>('session');

    React.useEffect(() => {
        if (isOpen) {
            setCapabilities({ readFiles: true, readGit: true, runCommands: false });
            setFocusedIndex(2);
            setTrustMode('session');
        }
    }, [isOpen]);

    useScope('trust-prompt');
    useKey('ArrowUp', () => setFocusedIndex((prev) => (prev > 0 ? prev - 1 : CHECKBOX_ITEMS.length - 1)), { enabled: isOpen });
    useKey('ArrowDown', () => setFocusedIndex((prev) => (prev < CHECKBOX_ITEMS.length - 1 ? prev + 1 : 0)), { enabled: isOpen });
    useKey(' ', () => toggleCapability(CHECKBOX_ITEMS[focusedIndex].key), { enabled: isOpen });
    useKey('Enter', () => onConfirm(capabilities), { enabled: isOpen });

    const toggleCapability = (key: keyof TrustCapabilities) => {
        setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title="Trust this directory?"
            className="max-w-[580px]"
        >
            <div className="p-6 flex flex-col gap-6">
                <div className="flex flex-col">
                    {CHECKBOX_ITEMS.map((item, index) => (
                        <Checkbox
                            key={item.key}
                            checked={capabilities[item.key]}
                            onChange={() => toggleCapability(item.key)}
                            label={item.label}
                            focused={focusedIndex === index}
                        />
                    ))}
                </div>

                <div className="w-full text-[--tui-border] overflow-hidden whitespace-nowrap select-none text-xs tracking-tighter opacity-50">
                    {'─'.repeat(80)}
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-[--tui-fg] opacity-50 uppercase tracking-widest font-semibold">
                        Current Directory
                    </span>
                    <div className="text-sm text-[--tui-fg] font-medium break-all">
                        {directory}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[10px] text-[--tui-fg] opacity-50 uppercase tracking-widest font-semibold">
                        Trust Mode
                    </span>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setTrustMode('session')}
                            className={cn(
                                'text-sm px-2 py-1 transition-colors',
                                trustMode === 'session'
                                    ? 'bg-[--tui-blue] text-black font-bold'
                                    : 'text-[--tui-fg] hover:bg-[--tui-selection]'
                            )}
                        >
                            Session only
                        </button>
                        <button
                            type="button"
                            onClick={() => setTrustMode('persistent')}
                            className={cn(
                                'text-sm px-2 py-1 transition-colors',
                                trustMode === 'persistent'
                                    ? 'bg-[--tui-blue] text-black font-bold'
                                    : 'text-[--tui-fg] hover:bg-[--tui-selection]'
                            )}
                        >
                            Persistent
                        </button>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => onConfirm(capabilities)}>
                        Trust
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
