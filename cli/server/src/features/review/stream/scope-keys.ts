/**
 * The identity keys a review is compared by: the scope it covers and the
 * configuration it ran under. Pure string builders over their own inputs — the
 * session registry consumes them, and so does the service that decides whether
 * an incoming request is the same review as one already in flight.
 */

export function buildScopeKey(params: {
  files?: string[];
  lenses?: string[];
  profile?: string;
}): string {
  const parts: string[] = [];
  if (params.files && params.files.length > 0) {
    // JSON-encode the file list so filenames containing the "," or "|" delimiters
    // cannot make two different selections collapse onto the same scope key.
    parts.push(`f:${JSON.stringify([...params.files].sort())}`);
  }
  if (params.lenses && params.lenses.length > 0) {
    parts.push(`l:${[...params.lenses].sort().join(",")}`);
  }
  if (params.profile) {
    parts.push(`p:${params.profile}`);
  }
  return parts.join("|");
}

export function buildReviewConfigKey(params: {
  lenses?: string[];
  profile?: string;
  minSeverity?: string;
  admittedExecutionFingerprint?: string;
  configurationId?: string;
  configurationRevision?: number;
}): string {
  const parts: string[] = [];
  if (params.lenses && params.lenses.length > 0) {
    parts.push(`l:${[...params.lenses].sort().join(",")}`);
  }
  if (params.profile) {
    parts.push(`p:${params.profile}`);
  }
  if (params.minSeverity) {
    parts.push(`s:${params.minSeverity}`);
  }
  if (params.configurationId) {
    parts.push(`c:${params.configurationId}`);
  }
  if (params.configurationRevision !== undefined) {
    parts.push(`r:${params.configurationRevision}`);
  }
  if (params.admittedExecutionFingerprint) {
    parts.push(`f:${params.admittedExecutionFingerprint}`);
  }
  return parts.join("|");
}
