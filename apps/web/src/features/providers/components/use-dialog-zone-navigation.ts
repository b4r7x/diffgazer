import { useState } from "react";

export type FocusZone = "search" | "filters" | "list" | "footer";

export function useDialogZoneNavigation() {
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [filterIndex, setFilterIndex] = useState(0);
  const [footerButtonIndex, setFooterButtonIndex] = useState(1);

  const resetZones = () => {
    setFocusZone("list");
    setFilterIndex(0);
    setFooterButtonIndex(1);
  };

  const moveFilterLeft = () => {
    setFilterIndex((prev) => (prev > 0 ? prev - 1 : 2));
  };

  const moveFilterRight = () => {
    setFilterIndex((prev) => (prev < 2 ? prev + 1 : 0));
  };

  return {
    focusZone,
    setFocusZone,
    filterIndex,
    setFilterIndex,
    footerButtonIndex,
    setFooterButtonIndex,
    resetZones,
    moveFilterLeft,
    moveFilterRight,
  };
}
