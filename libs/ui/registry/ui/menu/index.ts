import { Menu as MenuRoot, type MenuProps } from "./menu";
import { MenuItem, type MenuItemProps } from "./menu-item";
import { MenuDivider, type MenuDividerProps } from "./menu-divider";

const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});

export { Menu, type MenuProps };
export { MenuItem, type MenuItemProps };
export { MenuDivider, type MenuDividerProps };
