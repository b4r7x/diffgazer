"use client";

import { createContext, useContext } from "react";

export interface NavigationListGroupContextValue {
  variant: "tree" | "section";
  depth: number;
  linePrefix: string;
}

const defaultGroupContext: NavigationListGroupContextValue = {
  variant: "section",
  depth: 0,
  linePrefix: "",
};

export const NavigationListGroupContext = createContext<NavigationListGroupContextValue>(defaultGroupContext);

export function useNavigationListGroupContext() {
  return useContext(NavigationListGroupContext);
}

export interface NavigationListGroupPositionContextValue {
  isLast: boolean;
}

export const NavigationListGroupPositionContext = createContext<NavigationListGroupPositionContextValue | undefined>(undefined);

export function useNavigationListGroupPositionContext() {
  return useContext(NavigationListGroupPositionContext);
}
