"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicConfig } from "@/types/config";

const ConfigContext = createContext<PublicConfig | null>(null);

export function ConfigProvider({ config, children }: { config: PublicConfig; children: ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>;
}

export function useConfig(): PublicConfig {
  const c = useContext(ConfigContext);
  if (!c) throw new Error("useConfig outside ConfigProvider");
  return c;
}
