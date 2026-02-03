import React from "react";
import { Text } from "ink";
import Spinner from "ink-spinner";
import type { ServerState } from "../../lib/servers/server-store.js";

export interface StatusEntry {
  label: string;
  state: ServerState;
}

export function StatusDisplay(): React.ReactElement {
  return (
    <>
      <Text dimColor>Esc to exit</Text>
    </>
  );
}
