import axeCore, { type RunOptions } from "axe-core";

export function axe(container: Element, options?: RunOptions) {
  return axeCore.run(container, {
    ...options,
    rules: {
      "color-contrast": { enabled: false },
      ...options?.rules,
    },
  });
}
