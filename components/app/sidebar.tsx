"use client";

import { Bot, Coins, Film, Image as ImageIcon, KeyRound, MessageSquare, Plus, Settings, Terminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConfig } from "@/components/providers/config-provider";
import { Logo } from "@/components/ui/logo";
import { WalletButton } from "@/components/wallet/wallet-button";
import { deleteConversation, listConversations } from "@/lib/storage/db";
import { useLive } from "@/lib/storage/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { useAccount } from "./account-provider";

const NAV = [
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/image", label: "Image", icon: ImageIcon },
  { href: "/app/video", label: "Video", icon: Film },
  { href: "/app/code", label: "Code", icon: Terminal },
  { href: "/app/developers", label: "API", icon: KeyRound },
  { href: "/app/credits", label: "Credits", icon: Coins },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { appName } = useConfig();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const activeId = pathname === "/app" ? params.get("c") : null;
  const { value: conversations, ready } = useLive("conversations", listConversations, []);
  const { account } = useAccount();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link href="/" onClick={onNavigate} aria-label={`${appName} home`}>
          <Logo name={appName} />
        </Link>
      </div>
      <div className="px-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13.5px] font-medium shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-colors hover:border-ink/30"
          data-testid="new-chat"
        >
          <Plus size={15} /> New chat
        </Link>
      </div>

      <nav aria-label="Conversations" className="scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto px-3">
        <p className="eyebrow flex items-center justify-between px-2 pb-1.5">
          <span>On this device</span>
        </p>
        {!ready ? (
          <div className="space-y-1.5 px-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shimmer h-6 rounded" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-2 text-[12.5px] leading-relaxed text-dim">No conversations yet. They&apos;ll be saved in this browser only.</p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <Link
                  href={`/app?c=${c.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex h-8 items-center rounded-md pr-8 pl-2 text-[13px] transition-colors",
                    activeId === c.id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-ink/[0.04] hover:text-ink",
                  )}
                  title={`${c.title} · ${timeAgo(c.updatedAt)}`}
                >
                  <span className="truncate">{c.title}</span>
                </Link>
                <button
                  aria-label={`Delete ${c.title}`}
                  onClick={async () => {
                    if (!confirm("Delete this conversation from this device?")) return;
                    await deleteConversation(c.id);
                    if (activeId === c.id) router.push("/app");
                  }}
                  className="absolute top-1/2 right-1 hidden -translate-y-1/2 rounded p-1 text-dim hover:text-danger group-hover:block focus:block"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>

      <div className="border-t border-line-2 px-3 pt-3 pb-3">
        <ul className="space-y-0.5">
          <li>
            <Link
              href="/app"
              onClick={onNavigate}
              className={cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px]", pathname === "/app" ? "text-ink" : "text-ink-2 hover:text-ink")}
            >
              <MessageSquare size={15} /> Chat
            </Link>
          </li>
          {NAV.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={onNavigate}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
                  pathname.startsWith(n.href) ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
                )}
              >
                <n.icon size={15} /> {n.label}
                {n.href === "/app/credits" && account ? (
                  <span className="ml-auto font-mono text-[11px] text-dim tabular-nums" data-testid="sidebar-balance">
                    {account.balance.toLocaleString("en-US")}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <WalletButton />
        </div>
      </div>
    </div>
  );
}
