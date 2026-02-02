import { useState, useMemo, useCallback } from "react";
import type { TriageIssue } from "@repo/schemas/triage";
import { SEVERITY_ORDER } from "@repo/schemas/ui";
import type { SeverityFilter } from "../../../components/ui/severity/index.js";
import { calculateSeverityCounts } from "@repo/core";
import type { SeverityCounts } from "@repo/schemas/ui";
import { filterIssuesByPattern as filterIssues } from "@repo/core/review";

interface UseIssueFilteringOptions {
  issues: TriageIssue[];
}

interface UseIssueFilteringReturn {
  filteredIssues: TriageIssue[];
  severityCounts: SeverityCounts;
  severityFilter: SeverityFilter;
  setSeverityFilter: (filter: SeverityFilter) => void;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  ignoredPatterns: string[];
  addIgnoredPattern: (pattern: string) => void;
  filterFocusedIndex: number;
  handleFilterNavigate: (direction: "left" | "right") => void;
  handleFilterSelect: () => void;
  filterInfo: string;
}

export function useIssueFiltering({
  issues,
}: UseIssueFilteringOptions): UseIssueFilteringReturn {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [ignoredPatterns, setIgnoredPatterns] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [filterFocusedIndex, setFilterFocusedIndex] = useState(0);

  const severityCounts = useMemo(() => calculateSeverityCounts(issues), [issues]);

  // Apply text filter and ignored patterns first
  const textFilteredIssues = useMemo(
    () => filterIssues(issues, activeFilter, ignoredPatterns),
    [issues, activeFilter, ignoredPatterns]
  );

  // Then apply severity filter
  const filteredIssues = useMemo(() => {
    if (severityFilter === "all") {
      return textFilteredIssues;
    }
    return textFilteredIssues.filter((issue) => issue.severity === severityFilter);
  }, [textFilteredIssues, severityFilter]);

  const addIgnoredPattern = useCallback((pattern: string) => {
    setIgnoredPatterns((prev) => [...prev, pattern]);
  }, []);

  const handleFilterNavigate = useCallback((direction: "left" | "right") => {
    setFilterFocusedIndex((prev) => {
      const delta = direction === "right" ? 1 : -1;
      const newIndex = prev + delta;
      return Math.max(0, Math.min(newIndex, SEVERITY_ORDER.length - 1));
    });
  }, []);

  const handleFilterSelect = useCallback(() => {
    const selectedSeverity = SEVERITY_ORDER[filterFocusedIndex];
    if (selectedSeverity) {
      setSeverityFilter((prev) =>
        prev === selectedSeverity ? "all" : selectedSeverity
      );
    }
  }, [filterFocusedIndex]);

  const filterInfo = useMemo(() => {
    const parts: string[] = [];
    if (activeFilter) {
      parts.push(`filter: "${activeFilter}"`);
    }
    if (ignoredPatterns.length > 0) {
      parts.push(`${ignoredPatterns.length} ignored`);
    }
    if (filteredIssues.length !== issues.length) {
      parts.push(`showing ${filteredIssues.length}/${issues.length}`);
    }
    return parts.join(" | ");
  }, [activeFilter, ignoredPatterns.length, filteredIssues.length, issues.length]);

  return {
    filteredIssues,
    severityCounts,
    severityFilter,
    setSeverityFilter,
    activeFilter,
    setActiveFilter,
    ignoredPatterns,
    addIgnoredPattern,
    filterFocusedIndex,
    handleFilterNavigate,
    handleFilterSelect,
    filterInfo,
  };
}
