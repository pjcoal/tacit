import { cn } from "@/lib/utils";

/** Original mark: a disc split by a horizontal redaction slit. */
export function LogoMark({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 0 1 10 10.0H2A10 10 0 0 1 12 2Z" fill="currentColor" transform="translate(0 -1.6)" />
      <path d="M2 12h20a10 10 0 0 1-20 0Z" fill="currentColor" transform="translate(0 1.6)" />
      <rect x="15.5" y="11.1" width="6.5" height="1.8" rx="0.9" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[-0.02em] lowercase">{name}</span>
    </span>
  );
}
