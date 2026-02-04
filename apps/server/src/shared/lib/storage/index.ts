export type { StoreError, StoreErrorCode } from "./persistence.js";

export { sessionStore, createSession, addMessage, listSessions, getLastSession } from "./sessions.js";

export {
  createEventSession,
  appendEvent,
  loadEvents,
  listEventSessions,
  getLatestSession,
} from "./session-events.js";
export type { SessionMetadataInfo, SessionEventError } from "./session-events.js";

export { reviewStore, saveReview, listReviews } from "./review-history.js";

export {
  triageReviewStore,
  saveTriageReview,
  addDrilldownToReview,
  listTriageReviews,
  getTriageReview,
  deleteTriageReview,
} from "./review-storage.js";
export type { SaveTriageReviewOptions } from "./review-storage.js";

export { createSession as createActiveSession, addEvent, markComplete, markReady, getActiveSessionForProject, getSession, subscribe } from "./active-sessions.js";
export type { ActiveSession } from "./active-sessions.js";

export { paths, APP_NAME } from "./paths.js";
