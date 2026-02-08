export const INPUT_METHODS = ["paste", "env"] as const;
export type InputMethod = (typeof INPUT_METHODS)[number];
