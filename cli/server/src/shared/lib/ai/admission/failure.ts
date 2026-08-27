export type AdmissionFailureCode =
  | "configuration-not-found"
  | "configuration-migration-required"
  | "configuration-unsupported"
  | "configuration-revoking"
  | "readiness-not-ready"
  | "conformance-failed"
  | "acknowledgement-required"
  | "tuple-changed"
  | "budget-exhausted"
  | "adapter-unavailable"
  | "lease-denied";

export type AdmissionFailure = Readonly<{
  code: AdmissionFailureCode;
  safeMessage: string;
  retryable: boolean;
}>;

export function admissionFailure(
  code: AdmissionFailureCode,
  safeMessage: string,
  retryable = false,
): AdmissionFailure {
  return { code, safeMessage, retryable };
}
