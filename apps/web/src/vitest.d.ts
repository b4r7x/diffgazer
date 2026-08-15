import "vitest";

interface CustomMatchers<R = unknown> {
  toBeClientSafeDom: () => R;
}

declare module "vitest" {
  // biome-ignore lint/suspicious/noExplicitAny: must match vitest's upstream Assertion<T = any> generic default to merge the augmentation
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
