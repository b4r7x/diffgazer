/**
 * Centralized types for the review feature
 */

/** Review mode - what scope of changes to review */
export type ReviewMode = 'unstaged' | 'staged' | 'files';

/** Tab identifiers for issue details pane */
export type TabId = 'details' | 'explain' | 'trace' | 'patch';

/** Metrics displayed during review progress */
export interface ReviewProgressMetrics {
  filesProcessed: number;
  filesTotal: number;
  issuesFound: number;
  elapsed: number;
}
