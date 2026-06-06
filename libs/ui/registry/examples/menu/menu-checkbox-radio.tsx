"use client";

import { useState } from "react";
import { Menu, MenuDivider, MenuItemCheckbox, MenuItemRadio, MenuLabel } from "@/components/ui/menu";

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
        <MenuItemCheckbox id="hidden" checked={showHidden} onChange={setShowHidden}>
          Show Hidden Files
        </MenuItemCheckbox>
        <MenuItemCheckbox id="line-numbers" checked={lineNumbers} onChange={setLineNumbers}>
          Line Numbers
        </MenuItemCheckbox>
        <MenuItemCheckbox id="word-wrap" checked={wordWrap} onChange={setWordWrap}>
          Word Wrap
        </MenuItemCheckbox>
        <MenuItemCheckbox id="minimap" checked={minimap} onChange={setMinimap}>
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
