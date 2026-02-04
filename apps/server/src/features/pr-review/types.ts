export type AnnotationLevel = "notice" | "warning" | "failure";

export interface GitHubAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: AnnotationLevel;
  message: string;
  title: string;
}

export interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

export interface PRReviewResponse {
  summary: string;
  issues: Array<{
    severity: string;
    title: string;
    file: string;
    line: number;
    message: string;
    suggestion?: string;
  }>;
  annotations: GitHubAnnotation[];
  inlineComments: InlineComment[];
}
