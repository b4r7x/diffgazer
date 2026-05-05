import axeCore from "axe-core";

export function axe(container, options) {
  return axeCore.run(container, {
    ...options,
    rules: {
      "color-contrast": { enabled: false },
      ...options?.rules,
    },
  });
}
