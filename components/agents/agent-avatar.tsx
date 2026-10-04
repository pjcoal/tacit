import { cn } from "@/lib/utils";

const TONES = [
  "bg-[#5546e8] text-white",
  "bg-[#12876b] text-white",
  "bg-[#a5680f] text-white",
  "bg-ink text-bg",
  "bg-[#c53a2f] text-white",
  "bg-[#2f6fd6] text-white",
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** A stable initial-and-colour mark for an agent. */
export function AgentAvatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  const initial = (name.trim()[0] ?? "A").toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-xl font-semibold", TONES[hash(name.trim().toLowerCase()) % TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}
