"use client";

import type { ReactNode } from "react";
import { SolanaProviders } from "@/components/wallet/wallet-provider";
import { AdminGate } from "./admin-auth";

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SolanaProviders>
      <AdminGate>{children}</AdminGate>
    </SolanaProviders>
  );
}
