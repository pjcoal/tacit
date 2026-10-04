"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, m } from "framer-motion";
import { ArrowUpRight, Bot, ChevronDown, Code2, Film, ImageIcon, KeyRound, Menu, MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useConfig } from "@/components/providers/config-provider";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  { href: "/app", label: "Chat", desc: "One private composer, routed by Auto", icon: MessageSquare },
  { href: "/app/agents", label: "Agents", desc: "Build your own private assistants", icon: Bot },
  { href: "/app/image", label: "Image", desc: "Generate and keep images locally", icon: ImageIcon },
  { href: "/app/video", label: "Video", desc: "Text- and image-to-video", icon: Film },
  { href: "/app/code", label: "Code", desc: "An agent that builds and previews", icon: Code2 },
  { href: "/app/developers", label: "API", desc: "OpenAI-compatible endpoint", icon: KeyRound },
];

const LINKS = [
  { href: "/#solutions", label: "Solutions" },
  { href: "/#app", label: "App" },
  { href: "/#agents", label: "Agents" },
  { href: "/#code", label: "Code" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#plans", label: "Plans" },
  { href: "/#token", label: "Token" },
  { href: "/#api", label: "API" },
];

export function Nav() {
  const { appName } = useConfig();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300",
          scrolled || open ? "border-b border-line-2 bg-bg/80 backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent",
        )}
      >
        <nav aria-label="Main" className="container-x flex h-16 items-center gap-8">
          <Link href="/" aria-label={`${appName} home`} className="shrink-0">
            <Logo name={appName} />
          </Link>

          <div className="hidden items-center gap-6 text-[14px] text-ink-2 lg:flex">
            <DM.Root modal={false}>
              <DM.Trigger className="group inline-flex items-center gap-1 outline-none transition-colors hover:text-ink data-[state=open]:text-ink">
                Products <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" />
              </DM.Trigger>
              <DM.Portal>
                <DM.Content
                  align="start"
                  sideOffset={14}
                  className="z-[60] w-[340px] rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)] data-[state=open]:animate-[pop-in_180ms_var(--ease)]"
                >
                  {PRODUCTS.map((p) => (
                    <DM.Item key={p.href} asChild>
                      <Link href={p.href} className="flex items-start gap-3 rounded-xl px-3 py-2.5 outline-none hover:bg-sunken focus:bg-sunken">
                        <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg border border-line bg-bg text-ink">
                          <p.icon size={15} />
                        </span>
                        <span>
                          <span className="block text-[14px] font-medium text-ink">{p.label}</span>
                          <span className="block text-[12.5px] text-dim">{p.desc}</span>
                        </span>
                      </Link>
                    </DM.Item>
                  ))}
                </DM.Content>
              </DM.Portal>
            </DM.Root>
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
                {l.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/app/developers" className="hidden px-2 text-[14px] text-ink-2 transition-colors hover:text-ink sm:inline">
              Get API key
            </Link>
            <ButtonLink href="/app" size="sm" className="h-9 px-4">
              Launch App
            </ButtonLink>
            <button
              className="-mr-2 grid h-10 w-10 place-items-center rounded-lg text-ink lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open ? (
          <m.div
            id="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 top-16 z-40 overflow-y-auto bg-bg lg:hidden"
          >
            <div className="container-x pt-6 pb-16">
              <p className="eyebrow">Products</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PRODUCTS.map((p) => (
                  <Link key={p.href} href={p.href} onClick={() => setOpen(false)} className="card flex items-center gap-2.5 px-3 py-3 text-[14px]">
                    <p.icon size={16} className="text-ink-2" />
                    {p.label}
                  </Link>
                ))}
              </div>
              <ul className="mt-8 border-t border-line">
                {LINKS.map((l, i) => (
                  <m.li
                    key={l.href}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.3 }}
                    className="border-b border-line"
                  >
                    <Link href={l.href} onClick={() => setOpen(false)} className="flex items-center justify-between py-4 font-serif text-[30px] leading-none">
                      {l.label}
                      <ArrowUpRight size={18} className="text-dim" />
                    </Link>
                  </m.li>
                ))}
              </ul>
              <div className="mt-8 grid gap-2">
                <ButtonLink href="/app" size="lg" onClick={() => setOpen(false)}>
                  Start private chat
                </ButtonLink>
                <ButtonLink href="/app/developers" variant="secondary" size="lg" onClick={() => setOpen(false)}>
                  Get API key
                </ButtonLink>
              </div>
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
