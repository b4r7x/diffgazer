import { type ReactNode, useRef } from "react";
import { type ExitPreparation, ExitPreparationContext } from "../../hooks/use-exit";

export function ExitPreparationProvider({ children }: { children: ReactNode }) {
  const preparationRef = useRef<ExitPreparation | null>(null);
  return <ExitPreparationContext value={{ preparationRef }}>{children}</ExitPreparationContext>;
}
