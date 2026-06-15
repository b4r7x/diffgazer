import { type KbdProps, Kbd as KbdRoot, kbdVariants } from "./kbd";
import { KbdGroup, type KbdGroupProps } from "./kbd-group";

/** Keyboard key indicator rendered as an inline kbd element with terminal styling. */
const Kbd = Object.assign(KbdRoot, {
  Group: KbdGroup,
});

export { Kbd, kbdVariants, type KbdProps };
export { KbdGroup, type KbdGroupProps };
