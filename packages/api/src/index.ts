export { createApiClient } from "./client.js";
export type { ApiClient, ApiClientConfig, ApiError, RequestOptions, StreamOptions } from "./types.js";

// Shared API functions
export { streamTriage, streamTriageWithEvents, resumeTriageStream } from "./triage.js";
export type { StreamTriageRequest, StreamTriageOptions, StreamTriageResult, StreamTriageError, ResumeTriageOptions } from "./triage.js";

export { getSession, deleteSession } from "./sessions.js";
export { getReview, deleteReview } from "./reviews.js";
export { deleteConfig } from "./config.js";
