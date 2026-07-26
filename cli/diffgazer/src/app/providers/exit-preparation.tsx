import { type ReactNode, useRef } from "react";
import {
  type ExitPreparation,
  ExitPreparationContext,
  type ExitProcess,
} from "../../hooks/use-exit";

export function ExitPreparationProvider({
  children,
  exitProcess,
}: {
  children: ReactNode;
  exitProcess?: ExitProcess;
}) {
  const preparationRef = useRef<ExitPreparation | null>(null);
  return (
    <ExitPreparationContext value={{ preparationRef, exitProcess }}>
      {children}
    </ExitPreparationContext>
  );
}
