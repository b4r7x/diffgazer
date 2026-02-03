export interface ReviewHistoryMetadata {
  id: string;
  issueCount: number;
  projectPath?: string;
  createdAt?: string;
  staged?: boolean;
  branch?: string | null;
  overallScore?: number;
  criticalCount?: number;
  warningCount?: number;
}

export interface SavedReview {
  metadata: ReviewHistoryMetadata;
  result: unknown;
  gitContext?: unknown;
}
