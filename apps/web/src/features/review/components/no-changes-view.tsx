import { useScope, useKey } from 'keyscope';
import { usePageFooter } from '@/hooks/use-page-footer';
import { Button } from '@diffgazer/ui';
import type { ReviewMode } from '@diffgazer/schemas/review';

export interface NoChangesViewProps {
  mode: ReviewMode;
  onBack: () => void;
  onSwitchMode?: () => void;
}

const MESSAGES: Record<ReviewMode, { title: string; message: string; switchLabel: string }> = {
  staged: {
    title: 'No Staged Changes',
    message: "No staged changes found. Use 'git add' to stage files, or review unstaged changes instead.",
    switchLabel: 'Review Unstaged',
  },
  unstaged: {
    title: 'No Unstaged Changes',
    message: 'No unstaged changes found. Make some edits first, or review staged changes instead.',
    switchLabel: 'Review Staged',
  },
  files: {
    title: 'No Changes in Selected Files',
    message: 'No changes found in the selected files. Make some edits first, or select different files.',
    switchLabel: 'Review Unstaged',
  },
};

export function NoChangesView({ mode, onBack, onSwitchMode }: NoChangesViewProps) {
  useScope('no-changes');

  useKey('Escape', onBack);
  useKey('Enter', () => onSwitchMode?.(), { enabled: !!onSwitchMode });

  const footerShortcuts = onSwitchMode
    ? [{ key: 'Enter', label: MESSAGES[mode].switchLabel }]
    : [];
  const footerRightShortcuts = [{ key: 'Esc', label: 'Back' }];

  usePageFooter({ shortcuts: footerShortcuts, rightShortcuts: footerRightShortcuts });

  const { title, message } = MESSAGES[mode];

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-md p-6">
        <div className="text-tui-yellow text-lg font-bold mb-4">{title}</div>
        <p className="text-tui-muted font-mono text-sm mb-6">{message}</p>
        <div className="flex gap-4 justify-center">
          {onSwitchMode && (
            <Button
              variant="outline"
              bracket
              className="border-tui-blue hover:bg-tui-blue/20"
              onClick={onSwitchMode}
            >
              {MESSAGES[mode].switchLabel}
            </Button>
          )}
          <Button
            variant="secondary"
            bracket
            onClick={onBack}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
