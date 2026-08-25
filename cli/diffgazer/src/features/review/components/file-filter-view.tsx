import { useGitStatus } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  CONFLICTED_FILE_NOTE,
  describeFileStatus,
  type ReviewableFile,
  reviewableFilesForMode,
} from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import {
  BACK_SHORTCUTS,
  NAVIGATE_SHORTCUT,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { MAX_REVIEW_FILES, type ReviewMode } from "@diffgazer/core/schemas/review";
import { Box, Text, useInput } from "ink";
import { type ReactElement, type ReactNode, useState } from "react";
import { useContentZone } from "../../../components/layout/global";
import { Callout } from "../../../components/ui/callout";
import { CheckboxGroup } from "../../../components/ui/checkbox";
import { EmptyState } from "../../../components/ui/empty-state";
import { Panel } from "../../../components/ui/panel";
import { Spinner } from "../../../components/ui/spinner";
import { getListWindow } from "../../../lib/list-window";
import { useTheme } from "../../../theme/provider";

export interface ReviewFileFilterViewProps {
  mode: Exclude<ReviewMode, "files">;
  /** Why the picker was opened — the size warning or the over-window failure that sent the user here. */
  reason?: string;
  /**
   * Starts the narrowed run. `files` is omitted when every reviewable file is
   * picked: that is the run the mode already describes, and naming each file
   * would only restate it.
   */
  onStart: (files?: [string, ...string[]]) => void;
  onBack: () => void;
}

const SELECT_ALL_KEY = "a";
const CLEAR_SELECTION_KEY = "n";
const START_KEY = "s";

/**
 * Rows the list cannot use: the panel's two border rows, its header, the scope
 * line under it, and the two rows the scroll indicators take when the change set
 * is longer than the frame.
 */
const LIST_CHROME_ROWS = 6;

function getFileFilterShortcuts(hasSelection: boolean): Shortcut[] {
  return [
    NAVIGATE_SHORTCUT,
    { key: "Space", label: "Toggle" },
    { key: SELECT_ALL_KEY, label: "All" },
    { key: CLEAR_SELECTION_KEY, label: "None" },
    { key: START_KEY, label: "Review Selected", disabled: !hasSelection },
  ];
}

function describeSelection(selectedCount: number, total: number): string {
  if (selectedCount === 0) return `${total} reviewable, none selected`;
  return `${total} reviewable, ${selectedCount} selected`;
}

/** Width of the status column, so the paths line up under each other. */
function getStatusWidth(rows: ReviewableFile[]): number {
  return rows.reduce((width, row) => Math.max(width, describeFileStatus(row.status).length), 0);
}

export function ReviewFileFilterView({
  mode,
  reason,
  onStart,
  onBack,
}: ReviewFileFilterViewProps): ReactElement {
  const { tokens } = useTheme();
  const { contentRows } = useContentZone();
  const gitStatus = useGitStatus();
  const [selected, setSelected] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  const rows = gitStatus.data ? reviewableFilesForMode(gitStatus.data, mode) : [];
  // The server excludes conflicted files from every review, so they are shown as
  // dead rows rather than offered: picking one would silently review nothing.
  const selectableRows = rows.filter((row) => !row.conflicted);
  // Derived, never synced: a file that left the working tree since the picker
  // opened simply stops being the highlight, and the list starts over at the
  // first row that can actually be picked.
  const highlightedPath =
    highlighted !== null && selectableRows.some((row) => row.path === highlighted)
      ? highlighted
      : (selectableRows[0]?.path ?? null);
  const selectedPaths = selected.filter((path) => selectableRows.some((row) => row.path === path));
  const hasSelection = selectedPaths.length > 0;

  function start() {
    const [first, ...rest] = selectedPaths;
    if (first === undefined) return;
    onStart(selectedPaths.length === selectableRows.length ? undefined : [first, ...rest]);
  }

  function changeSelection(next: string[]) {
    // The cap is on the `files[]` the start sends, and a full selection sends
    // none — so only a subset past the ceiling is refused.
    if (next.length > MAX_REVIEW_FILES && next.length !== selectableRows.length) {
      setLimitNotice(`A review reads at most ${MAX_REVIEW_FILES} files. Deselect one first.`);
      return;
    }
    setLimitNotice(null);
    setSelected(next);
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (input === START_KEY && hasSelection) {
        start();
        return;
      }
      if (input === SELECT_ALL_KEY) {
        changeSelection(selectableRows.map((row) => row.path));
        return;
      }
      if (input === CLEAR_SELECTION_KEY) {
        changeSelection([]);
      }
    },
    { isActive: true },
  );

  usePageFooter({
    shortcuts: getFileFilterShortcuts(hasSelection),
    rightShortcuts: BACK_SHORTCUTS,
  });

  const listRows = Math.max(contentRows - LIST_CHROME_ROWS, 1);
  const highlightedIndex = Math.max(
    rows.findIndex((row) => row.path === highlightedPath),
    0,
  );
  const listWindow = getListWindow({
    selectedIndex: highlightedIndex,
    total: rows.length,
    viewportRows: listRows,
  });
  const statusWidth = getStatusWidth(rows);

  function renderBody(): ReactNode {
    if (gitStatus.isLoading) {
      return <Spinner label="Reading changed files..." />;
    }
    if (gitStatus.error) {
      return (
        <Text color={tokens.error}>
          {sanitizeTerminalText(
            getErrorMessage(gitStatus.error, "Could not read the changed files."),
          )}
        </Text>
      );
    }
    if (rows.length === 0) {
      return (
        <EmptyState>
          <EmptyState.Message>No changed files to pick from</EmptyState.Message>
          <EmptyState.Description>
            {mode === "staged"
              ? "Nothing is staged right now."
              : "The working tree has no unstaged changes right now."}
          </EmptyState.Description>
        </EmptyState>
      );
    }

    return (
      <Box flexDirection="column">
        {listWindow.canScrollUp ? <Text color={tokens.muted}>{"▲"}</Text> : null}
        <CheckboxGroup
          value={selectedPaths}
          onChange={changeSelection}
          highlightedValue={highlightedPath}
          onHighlightChange={setHighlighted}
          navigationItems={rows.map((row) => ({ id: row.path, disabled: row.conflicted }))}
        >
          {rows.slice(listWindow.start, listWindow.end).map((row) => (
            <CheckboxGroup.Item
              key={row.path}
              value={row.path}
              disabled={row.conflicted}
              label={
                <Box gap={1}>
                  <Text color={tokens.muted}>
                    {describeFileStatus(row.status).padEnd(statusWidth)}
                  </Text>
                  <Text>{sanitizeTerminalText(row.path)}</Text>
                  {row.previousPath ? (
                    <Text color={tokens.muted}>
                      {`← ${sanitizeTerminalText(row.previousPath)}`}
                    </Text>
                  ) : null}
                </Box>
              }
              description={row.conflicted ? CONFLICTED_FILE_NOTE : undefined}
            />
          ))}
        </CheckboxGroup>
        {listWindow.canScrollDown ? <Text color={tokens.muted}>{"▼"}</Text> : null}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      {reason ? (
        <Callout variant="warning">
          <Callout.Title>Narrow the review</Callout.Title>
          <Callout.Content>{sanitizeTerminalText(reason)}</Callout.Content>
        </Callout>
      ) : null}
      <Panel>
        <Panel.Header>
          {mode === "staged" ? "Select Staged Files" : "Select Unstaged Files"}
        </Panel.Header>
        <Panel.Content>
          <Box flexDirection="column">
            <Text color={tokens.muted}>
              {describeSelection(selectedPaths.length, selectableRows.length)}
            </Text>
            {renderBody()}
            {limitNotice ? <Text color={tokens.warning}>{limitNotice}</Text> : null}
          </Box>
        </Panel.Content>
      </Panel>
    </Box>
  );
}
