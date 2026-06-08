import type { ReactNode } from "react";
import { ConfigProvider as SurfaceConfigProvider } from "@/hooks/use-config";

export function ConfigProvider({ children }: { children: ReactNode }) {
  return <SurfaceConfigProvider>{children}</SurfaceConfigProvider>;
}
