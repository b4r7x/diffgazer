import "vitest";

interface CustomMatchers<R = unknown> {
  toBeClientSafeDom: () => R;
  toBeClientSafePayload: () => R;
}

declare module "vitest" {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
