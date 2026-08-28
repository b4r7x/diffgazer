import { z } from "zod";
import { containsStructuralControlCharacter } from "../../sanitize-terminal.js";

// Keep path starts separate from the text that follows them.  We only need to
// prove that a client-safe string contains a path; consuming the complete
// token would make punctuation-sensitive boundaries both brittle and easy to
// bypass (for example `notice,/usr/local/bin/codex`).
const NON_PATH_CHARACTER = "[^\\\\/\\s\"'`<>{},;!?()\\[\\]]";
const FILESYSTEM_PATH_START_PATTERN = /(?:^|[^A-Za-z0-9_.-])(?:~[\\/]|[A-Za-z]:[\\/]|\.{1,2}[\\/])/;
const UNC_PATH_START_PATTERN = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9_.-])\\\\(?=${NON_PATH_CHARACTER}+[\\/]${NON_PATH_CHARACTER}+)`,
);

// A slash in normal prose (`Use / for alternatives`, `https://…`, or `a/b`)
// is not a filesystem path.  Require either another path separator, a
// conventional filesystem root, or punctuation that directly introduces the
// root.  The second branch deliberately excludes slash/backslash as a
// boundary, preventing the second slash in `https://` from becoming a path.
const UNIX_PATH_START_PATTERN =
  /(?:^|[^A-Za-z0-9_.\\/-])\/(?=(?:[A-Za-z0-9._~-]+[\\/]|(?:Users|home|private|var|tmp|usr|bin|sbin|srv|opt|etc|run|root|dev|proc|Applications|Library|System|Volumes)(?:[\\/]|$)))/;
const PUNCTUATED_UNIX_PATH_PATTERN = /(?:^|[,:;=()[\]{}])\s*\/(?=[A-Za-z0-9._~-])/;
const PUNCTUATED_UNIX_ROOT_PATTERN = /(?:^|[,:;=()[\]{}])\s*\/(?=$|[.,;:!?()[\]{}])/;

function containsFilesystemPath(value: string): boolean {
  return (
    FILESYSTEM_PATH_START_PATTERN.test(value) ||
    UNC_PATH_START_PATTERN.test(value) ||
    UNIX_PATH_START_PATTERN.test(value) ||
    PUNCTUATED_UNIX_PATH_PATTERN.test(value) ||
    PUNCTUATED_UNIX_ROOT_PATTERN.test(value)
  );
}

const SafeNoticeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine(
    (value) => !containsStructuralControlCharacter(value),
    "Notice id must not contain control characters",
  )
  .refine(
    (value) =>
      !/(?:api(?:[._:-]?key)|authorization|bearer|cookie|password|credential|secret|env(?:ironment)?|home|path|argv|executable|control)/i.test(
        value,
      ) &&
      !/\b(?:account|workspace)[._:-]?(?:secret|id|identifier|ref|reference|token|key|credential|value)/i.test(
        value,
      ),
    "Notice id must not contain secret or private-path material",
  );

const SafeNoticeLineSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => {
    if (containsStructuralControlCharacter(value)) return false;

    if (
      /\b(?:api(?:[ _-]?key)|authorization|bearer|cookie|password|credential|secret|env(?:ironment)?|home|path|argv|executable|control)\b/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b(?:auth|token|account|workspace)(?:[\s_/-]+)(?:secret|id|identifier|ref(?:erence)?|token|key|credential|value|name|account|workspace|env|environment|path|file)\b/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /(?:^|\s)--?(?:api(?:[ _-]?key)|authorization|auth|bearer|cookie|password|credential|secret|token|env(?:ironment)?)(?:\s+|[:=])\S+/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b(?:api(?:[ _-]?key)|authorization|auth|bearer|cookie|password|credential|secret|token|env(?:ironment)?)(?:\s*[:=])\s*\S+/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b[A-Z][A-Z0-9]*(?:[_-][A-Z0-9]+)*[_-](?:API[_-]?KEY|TOKEN|SECRET|AUTH(?:ORIZATION)?|CREDENTIAL|PASSWORD|COOKIE|BEARER)\b/.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /(?:^|[\s=:])(?:sk|pk|ghp|github_pat|xox[baprs]-)[A-Za-z0-9_-]{8,}/i.test(value) ||
      /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/-]{8,}=*/i.test(value)
    ) {
      return false;
    }

    if (containsFilesystemPath(value)) {
      return false;
    }

    return !/-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(value);
  }, "Notice text must not contain secret or private-path material");

export const ClientConfigurationNoticeSchema = z.strictObject({
  id: SafeNoticeIdSchema,
  noticeVersion: z.number().int().positive(),
  acknowledgement: z.literal("required"),
  acknowledgeBefore: z.literal("first-context-send"),
  renewAcknowledgementOn: z.literal("material-notice-change"),
  billing: z.array(SafeNoticeLineSchema).max(16),
  privacy: z.array(SafeNoticeLineSchema).max(16),
});
export type ClientConfigurationNotice = z.infer<typeof ClientConfigurationNoticeSchema>;
