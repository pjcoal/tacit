"use client";

import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <RD.Content
          className={cn(
            "fixed z-[90] bg-surface text-ink shadow-[var(--shadow-pop)] outline-none",
            // Phone: bottom sheet. Larger: centered card.
            "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t border-line",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border",
            wide ? "sm:w-[min(720px,calc(100vw-48px))]" : "sm:w-[min(460px,calc(100vw-48px))]",
            "data-[state=open]:animate-[pop-in_200ms_var(--ease)]",
            className,
          )}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line-2 bg-surface/95 px-5 pt-5 pb-4 backdrop-blur">
            <div>
              <RD.Title className="text-[17px] font-semibold tracking-[-0.01em]">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-[13.5px] text-ink-2">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RD.Description>}
            </div>
            <RD.Close className="-mr-1 rounded-md p-1 text-dim hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X size={18} />
            </RD.Close>
          </div>
          <div className="px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
