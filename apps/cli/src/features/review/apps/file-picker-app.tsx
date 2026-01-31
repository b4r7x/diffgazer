import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import Spinner from "ink-spinner";
import type { LensId, ProfileId } from "@repo/schemas/lens";
import type { TriageIssue } from "@repo/schemas/triage";
import type { DrilldownResult } from "@repo/schemas/lens";
import { useGitStatus } from "../../../hooks/use-git-status.js";
import { useTriage } from "../hooks/use-triage.js";
import { ReviewScreen } from "../components/review-screen.js";
import { ReviewDetailScreen } from "../components/review-detail-screen.js";
import { Separator } from "../../../components/ui/separator.js";

type Screen = "picker" | "list" | "detail";

interface FilePickerAppProps {
  staged: boolean;
  lenses?: LensId[];
  profile?: ProfileId;
}

function FileListItem({
  file,
  isSelected,
  isChecked,
}: {
  file: string;
  isSelected: boolean;
  isChecked: boolean;
}): React.ReactElement {
  const prefix = isSelected ? "> " : "  ";
  const checkBox = isChecked ? "[x]" : "[ ]";

  return (
    <Box flexDirection="row">
      <Text color={isSelected ? "green" : undefined}>{prefix}</Text>
      <Text color={isChecked ? "cyan" : undefined}>{checkBox} </Text>
      <Text>{file}</Text>
    </Box>
  );
}

export function FilePickerApp({
  staged,
  lenses,
  profile,
}: FilePickerAppProps): React.ReactElement {
  const { exit } = useApp();
  const { state: gitState, fetch: fetchStatus } = useGitStatus();
  const { state: triageState, startTriage } = useTriage({ lenses, profile });
  const [screen, setScreen] = useState<Screen>("picker");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(() => new Set());
  const [selectedIssue, setSelectedIssue] = useState<TriageIssue | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownResult | null>(null);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const files = useMemo(() => {
    if (gitState.status !== "success") return [];
    const fileData = staged ? gitState.data.files.staged : gitState.data.files.unstaged;
    return fileData.map((f) => f.path);
  }, [gitState, staged]);

  const prevFilesLengthRef = useRef(files.length);

  useEffect(() => {
    // Only clamp when files array shrinks
    if (files.length < prevFilesLengthRef.current && files.length > 0) {
      setSelectedIndex((idx) => Math.min(idx, files.length - 1));
    }
    prevFilesLengthRef.current = files.length;
  }, [files.length]);

  const toggleFile = useCallback((file: string) => {
    setCheckedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  }, []);

  const startReviewWithSelection = useCallback(() => {
    setScreen("list");
    void startTriage(staged);
  }, [staged, startTriage]);

  const handleSelectIssue = useCallback((issue: TriageIssue) => {
    setSelectedIssue(issue);
    setDrilldown(null);
    setScreen("detail");
  }, []);

  const handleBack = useCallback(() => {
    if (screen === "detail") {
      setScreen("list");
      setSelectedIssue(null);
      setDrilldown(null);
    } else if (screen === "list") {
      setScreen("picker");
    } else {
      exit();
    }
  }, [screen, exit]);

  useInput((input, key) => {
    if (screen !== "picker") return;

    if (input === "j" || key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, files.length - 1));
    }

    if (input === "k" || key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }

    if (input === " " && files[selectedIndex]) {
      toggleFile(files[selectedIndex]);
    }

    if (input === "a") {
      if (checkedFiles.size === files.length) {
        setCheckedFiles(new Set());
      } else {
        setCheckedFiles(new Set(files));
      }
    }

    if (key.return && checkedFiles.size > 0) {
      startReviewWithSelection();
    }

    if (input === "b" || key.escape) {
      exit();
    }

    if (input === "q") {
      exit();
    }
  });

  if (gitState.status === "loading") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Select Files to Review
        </Text>
        <Separator />
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading files...</Text>
        </Box>
      </Box>
    );
  }

  if (gitState.status === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Select Files to Review
        </Text>
        <Separator />
        <Text color="red">Error: {gitState.error.message}</Text>
        <Box marginTop={1}>
          <Text dimColor>[q] Quit</Text>
        </Box>
      </Box>
    );
  }

  if (screen === "detail" && selectedIssue) {
    return (
      <ReviewDetailScreen
        issue={selectedIssue}
        drilldown={drilldown}
        isLoadingDrilldown={false}
        onBack={handleBack}
        onDrilldown={() => {}}
      />
    );
  }

  if (screen === "list") {
    const isLoading = triageState.status === "loading";
    const result = triageState.status === "success" ? triageState.data : null;
    const lensProgress =
      triageState.status === "loading" || triageState.status === "success"
        ? triageState.lensProgress
        : undefined;

    return (
      <ReviewScreen
        review={null}
        result={result}
        isLoading={isLoading}
        lensProgress={lensProgress}
        onSelectIssue={handleSelectIssue}
        onBack={handleBack}
      />
    );
  }

  if (files.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">
          Select Files to Review
        </Text>
        <Separator />
        <Text>No {staged ? "staged" : "unstaged"} files found</Text>
        <Box marginTop={1}>
          <Text dimColor>[q] Quit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Select Files to Review
      </Text>
      <Text dimColor>
        ({staged ? "staged" : "unstaged"} changes - {checkedFiles.size}/{files.length} selected)
      </Text>
      <Separator />

      <Box flexDirection="column" marginTop={1}>
        {files.map((file, index) => (
          <FileListItem
            key={file}
            file={file}
            isSelected={index === selectedIndex}
            isChecked={checkedFiles.has(file)}
          />
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          [j/k] Navigate  [Space] Toggle  [a] Toggle all  [Enter] Review  [q] Quit
        </Text>
      </Box>
    </Box>
  );
}
