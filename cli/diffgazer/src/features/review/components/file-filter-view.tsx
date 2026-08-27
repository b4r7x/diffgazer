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
import { wrappedRowCount } from "../../../lib/terminal-width";
import { useTheme } from "../../../theme/provider";
import {
  CALLOUT_CHROME_COLUMNS,
  CALLOUT_CHROME_ROWS,
  calloutTextRows,
} from "../lib/callout-geometry";

type FileScope = Exclude<ReviewMode, "files">;

/** The narrowed run the picker asks for: a scope, and the files it is cut down to. */
export interface ReviewFileFilterStart {
  mode: FileScope;
  files?: [string, ...string[]];
}

export interface ReviewFileFilterViewProps {
  /**
   * The scope the picker is locked to — the mode of the run that sent the user
   * here. Omitted before any run has started, where there is no run to inherit
   * from and the picker owns the choice.
   */
  mode?: FileScope;
  /** Why the picker was opened — the size warning or the over-window failure that sent the user here. */
  reason?: string;
  /**
   * Starts the narrowed run. `files` is omitted when every reviewable file is
   * picked: that is the run the mode already describes, and naming each file
   * would only restate it.
   */
  onStart: (input: ReviewFileFilterStart) => void;
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
/** Columns the panel spends per row: its two borders and its horizontal padding. */
const PANEL_CHROME_COLUMNS = 4;
const REASON_TITLE = "Narrow the review";

function getFileFilterShortcuts(canStart: boolean, ownsScope: boolean): Shortcut[] {
  return [
    NAVIGATE_SHORTCUT,
    { key: "Space", label: "Toggle" },
    { key: SELECT_ALL_KEY, label: "All" },
    { key: CLEAR_SELECTION_KEY, label: "None" },
    ...(ownsScope ? [{ key: "Tab", label: "Switch Scope" }] : []),
    { key: START_KEY, label: "Review Selected", disabled: !canStart },
  ];
}

function describeSelection(selectedCount: number, total: number): string {
  if (selectedCount === 0) return `${total} reviewable, none selected`;
  return `${total} reviewable, ${selectedCount} selected`;
}

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
  const { contentRows, contentColumns } = useContentZone();
  const gitStatus = useGitStatus();
  const [selected, setSelected] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [pickedScope, setPickedScope] = useState<FileScope | null>(null);

  const ownsScope = mode === undefined;
  const rowsByScope: Record<FileScope, ReviewableFile[]> = {
    unstaged: gitStatus.data ? reviewableFilesForMode(gitStatus.data, "unstaged") : [],
    staged: gitStatus.data ? reviewableFilesForMode(gitStatus.data, "staged") : [],
  };
  // Opened cold, the picker lands on the side that has something to pick, so a
  // repo with only staged work does not open on an empty unstaged list.
  const hasStagedOnly = rowsByScope.unstaged.length === 0 && rowsByScope.staged.length > 0;
  const scope: FileScope = mode ?? pickedScope ?? (hasStagedOnly ? "staged" : "unstaged");
  const rows = rowsByScope[scope];
  // The server excludes conflicted files from every review, so they are shown as
  // dead rows rather than offered: picking one would silently review nothing.
  const selectableRows = rows.filter((row) => !row.conflicted);
  const highlightedPath =
    highlighted !== null && selectableRows.some((row) => row.path === highlighted)
      ? highlighted
      : (selectableRows[0]?.path ?? null);
  const selectedPaths = selected.filter((path) => selectableRows.some((row) => row.path === path));
  const hasSelection = selectedPaths.length > 0;
  // The cap is on the `files[]` the start sends, and a full selection sends
  // none — so only a subset past the ceiling is over the limit. The selection
  // itself is always recorded: refusing it would strand the user past the cap
  // with no way to deselect back under it.
  const isOverLimit =
    selectedPaths.length > MAX_REVIEW_FILES && selectedPaths.length !== selectableRows.length;
  const limitNotice = isOverLimit
    ? `A review reads at most ${MAX_REVIEW_FILES} files. Deselect ${selectedPaths.length - MAX_REVIEW_FILES} to start.`
    : null;
  const canStart = hasSelection && !isOverLimit;
  const sanitizedReason = reason ? sanitizeTerminalText(reason) : null;
  const calloutColumns = Math.max(contentColumns - CALLOUT_CHROME_COLUMNS, 1);
  const panelColumns = Math.max(contentColumns - PANEL_CHROME_COLUMNS, 1);

  function start() {
    const [first, ...rest] = selectedPaths;
    if (first === undefined) return;
    onStart({
      mode: scope,
      ...(selectedPaths.length === selectableRows.length ? {} : { files: [first, ...rest] }),
    });
  }

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack();
        return;
      }
      if (ownsScope && key.tab) {
        setPickedScope(scope === "staged" ? "unstaged" : "staged");
        return;
      }
      if (input === START_KEY && canStart) {
        start();
        return;
      }
      if (input === SELECT_ALL_KEY) {
        setSelected(selectableRows.map((row) => row.path));
        return;
      }
      if (input === CLEAR_SELECTION_KEY) {
        setSelected([]);
      }
    },
    { isActive: true },
  );

  usePageFooter({
    shortcuts: getFileFilterShortcuts(canStart, ownsScope),
    rightShortcuts: BACK_SHORTCUTS,
  });

  // The reason callout above the panel and the limit notice inside it take rows
  // from the same clipped content zone as the list, and the reason is server
  // text, so both are measured rather than assumed.
  const reasonRows = sanitizedReason
    ? CALLOUT_CHROME_ROWS +
      calloutTextRows(REASON_TITLE, calloutColumns) +
      calloutTextRows(sanitizedReason, calloutColumns)
    : 0;
  const noticeRows = limitNotice ? wrappedRowCount(limitNotice, panelColumns) : 0;
  const listRows = Math.max(contentRows - LIST_CHROME_ROWS - reasonRows - noticeRows, 1);
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
            {scope === "staged"
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
          onChange={setSelected}
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
      {sanitizedReason ? (
        <Callout variant="warning">
          <Callout.Title>{REASON_TITLE}</Callout.Title>
          <Callout.Content>{sanitizedReason}</Callout.Content>
        </Callout>
      ) : null}
      <Panel>
        <Panel.Header>
          {scope === "staged" ? "Select Staged Files" : "Select Unstaged Files"}
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
