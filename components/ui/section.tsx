import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

export function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
  className,
  align = "left",
}: {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      <p className="eyebrow flex items-center gap-2" style={align === "center" ? { justifyContent: "center" } : undefined}>
        {index ? <span className="text-ink">{index}</span> : null}
        {index ? <span aria-hidden className="h-px w-6 bg-line" /> : null}
        <span>{eyebrow}</span>
      </p>
      <h2 className="h-section mt-5 text-balance">{title}</h2>
      {lead ? <div className={cn("lead mt-5", align === "center" && "mx-auto")}>{lead}</div> : null}
    </Reveal>
  );
}

export function Section({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("scroll-mt-20 border-t border-line-2 py-20 md:py-28", className)}>
      <div className="container-x">{children}</div>
    </section>
  );
}
