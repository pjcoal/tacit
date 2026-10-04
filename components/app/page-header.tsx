import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({ icon: Icon, title, description, actions }: { icon: LucideIcon; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="eyebrow flex items-center gap-1.5">
          <Icon size={12} /> {title}
        </p>
        <h1 className="display mt-3 text-[40px] sm:text-[48px]">{title}</h1>
        {description ? <p className="mt-2 max-w-[60ch] text-[14.5px] text-ink-2">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
