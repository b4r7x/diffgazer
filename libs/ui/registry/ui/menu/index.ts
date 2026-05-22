"use client";

import { Menu as MenuRoot, type MenuProps } from "./menu";
import { MenuItem, type MenuItemProps } from "./menu-item";
import { MenuItemCheckbox, type MenuItemCheckboxProps } from "./menu-item-checkbox";
import { MenuItemRadio, type MenuItemRadioProps } from "./menu-item-radio";
import { MenuDivider, type MenuDividerProps } from "./menu-divider";
import { MenuGroup, type MenuGroupProps } from "./menu-group";
import { MenuLabel, type MenuLabelProps } from "./menu-label";
import { MenuSub, MenuSubTrigger, MenuSubContent, type MenuSubProps, type MenuSubTriggerProps, type MenuSubContentProps } from "./menu-sub";

const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  ItemCheckbox: MenuItemCheckbox,
  ItemRadio: MenuItemRadio,
  Divider: MenuDivider,
  Group: MenuGroup,
  Label: MenuLabel,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
});

export { Menu, type MenuProps };
export { MenuItem, type MenuItemProps };
export { MenuItemCheckbox, type MenuItemCheckboxProps };
export { MenuItemRadio, type MenuItemRadioProps };
export { MenuDivider, type MenuDividerProps };
export { MenuGroup, type MenuGroupProps };
export { MenuLabel, type MenuLabelProps };
export { MenuSub, type MenuSubProps };
export { MenuSubTrigger, type MenuSubTriggerProps };
export { MenuSubContent, type MenuSubContentProps };
