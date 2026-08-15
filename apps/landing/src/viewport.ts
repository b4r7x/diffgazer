export interface Flags {
  reduced: boolean;
  finePointer: boolean;
}

export function getFlags(): Flags {
  if (typeof matchMedia !== "function") return { reduced: true, finePointer: false };
  return {
    reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
    finePointer: matchMedia("(pointer: fine)").matches,
  };
}

export interface Mouse {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

export const createMouse = (): Mouse => ({
  x: innerWidth / 2,
  y: innerHeight / 2,
  nx: 0,
  ny: 0,
});

export const isLight = (doc: Document = document): boolean =>
  doc.documentElement.dataset.sceneTheme === "light";
