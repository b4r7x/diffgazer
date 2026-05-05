import { Kbd as KbdRoot, kbdVariants, type KbdProps } from "./kbd";
import { KbdGroup, type KbdGroupProps } from "./kbd-group";

const Kbd = Object.assign(KbdRoot, {
  Group: KbdGroup,
});

export { Kbd, kbdVariants, type KbdProps };
export { KbdGroup, type KbdGroupProps };
