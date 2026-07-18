"use client";

import { createContext, useContext } from "react";

/** Context value shared by navigation list group. */
export interface NavigationListGroupContextValue {
  /**
   * Visual treatment. "section" shows uppercase headers with counts, "tree" shows indented
   * hierarchy with ASCII connectors.
   */
  variant: "tree" | "section";
  depth: number;
  linePrefix: string;
}

const defaultGroupContext: NavigationListGroupContextValue = {
  variant: "section",
  depth: 0,
  linePrefix: "",
};

/** React context backing navigation list group. */
export const NavigationListGroupContext =
  createContext<NavigationListGroupContextValue>(defaultGroupContext);

/** Reads the navigation list group context. */
export function useNavigationListGroupContext() {
  return useContext(NavigationListGroupContext);
}

/** Context value shared by navigation list group position. */
export interface NavigationListGroupPositionContextValue {
  isLast: boolean;
}

/** React context backing navigation list group position. */
export const NavigationListGroupPositionContext = createContext<
  NavigationListGroupPositionContextValue | undefined
>(undefined);

/** Reads the navigation list group position context. */
export function useNavigationListGroupPositionContext() {
  return useContext(NavigationListGroupPositionContext);
}
