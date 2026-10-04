"use client";

import { AnimatePresence, m } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useState, type ReactNode } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { LogoMark } from "@/components/ui/logo";
import { SolanaProviders } from "@/components/wallet/wallet-provider";
import { AccountProvider } from "./account-provider";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { appName } = useConfig();

  return (
    <SolanaProviders>
      <AccountProvider>
        <div className="flex h-dvh overflow-hidden bg-bg">
          <aside className="hidden w-[260px] shrink-0 border-r border-line bg-sunken md:block">
            <Suspense>
              <Sidebar />
            </Suspense>
          </aside>

          <AnimatePresence>
            {drawer ? (
              <>
                <m.div
                  key="scrim"
                  className="fixed inset-0 z-40 bg-black/30 md:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setDrawer(false)}
                />
                <m.aside
                  key="drawer"
                  className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[300px] border-r border-line bg-sunken md:hidden"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 380, damping: 38 }}
                >
                  <button className="absolute top-3.5 right-3 rounded-md p-1.5 text-dim" onClick={() => setDrawer(false)} aria-label="Close menu">
                    <X size={18} />
                  </button>
                  <Suspense>
                    <Sidebar onNavigate={() => setDrawer(false)} />
                  </Suspense>
                </m.aside>
              </>
            ) : null}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line-2 px-3 md:hidden">
              <button onClick={() => setDrawer(true)} className="rounded-md p-1.5" aria-label="Open menu" data-testid="app-menu">
                <Menu size={19} />
              </button>
              <Link href="/app" className="flex items-center gap-2 text-[15px] font-semibold lowercase">
                <LogoMark size={18} /> {appName}
              </Link>
            </header>
            <main className="min-h-0 flex-1">{children}</main>
          </div>
        </div>
      </AccountProvider>
    </SolanaProviders>
  );
}
