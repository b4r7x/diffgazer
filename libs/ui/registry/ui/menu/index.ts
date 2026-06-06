"use client";

import { type MenuProps, Menu as MenuRoot } from "./menu";
import { MenuDivider, type MenuDividerProps } from "./menu-divider";
import { MenuGroup, type MenuGroupProps } from "./menu-group";
import { MenuItem, type MenuItemProps } from "./menu-item";
import { MenuItemCheckbox, type MenuItemCheckboxProps } from "./menu-item-checkbox";
import { MenuItemRadio, type MenuItemRadioProps } from "./menu-item-radio";
import { MenuLabel, type MenuLabelProps } from "./menu-label";
import { MenuSub, MenuSubContent, type MenuSubContentProps, type MenuSubProps, MenuSubTrigger, type MenuSubTriggerProps, type MenuSubTriggerVariantProps, menuSubTriggerBase } from "./menu-sub";

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
export { MenuSubTrigger, menuSubTriggerBase, type MenuSubTriggerProps, type MenuSubTriggerVariantProps };
export { MenuSubContent, type MenuSubContentProps };
