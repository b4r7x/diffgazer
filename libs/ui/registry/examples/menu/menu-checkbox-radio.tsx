"use client";

import { useState } from "react";
import { Menu, MenuItemCheckbox, MenuItemRadio, MenuDivider, MenuLabel } from "@/components/ui/menu";

export default function MenuCheckboxRadio() {
  const [showHidden, setShowHidden] = useState(true);
  const [lineNumbers, setLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(true);
  const [sortBy, setSortBy] = useState("name");

  return (
    <div className="w-64 border border-border">
      <Menu aria-label="View options" selectedId={sortBy} onSelect={setSortBy}>
        <MenuLabel>VIEW OPTIONS</MenuLabel>
        <MenuItemCheckbox id="hidden" checked={showHidden} onCheckedChange={setShowHidden}>
          Show Hidden Files
        </MenuItemCheckbox>
        <MenuItemCheckbox id="line-numbers" checked={lineNumbers} onCheckedChange={setLineNumbers}>
          Line Numbers
        </MenuItemCheckbox>
        <MenuItemCheckbox id="word-wrap" checked={wordWrap} onCheckedChange={setWordWrap}>
          Word Wrap
        </MenuItemCheckbox>
        <MenuItemCheckbox id="minimap" checked={minimap} onCheckedChange={setMinimap}>
          Minimap
        </MenuItemCheckbox>
        <MenuDivider />
        <MenuLabel>SORT BY</MenuLabel>
        <MenuItemRadio id="name" value="name">Name</MenuItemRadio>
        <MenuItemRadio id="date" value="date">Date Modified</MenuItemRadio>
        <MenuItemRadio id="size" value="size">Size</MenuItemRadio>
        <MenuItemRadio id="type" value="type">Type</MenuItemRadio>
      </Menu>
    </div>
  );
}
