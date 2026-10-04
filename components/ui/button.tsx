import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "panel";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,border-color,box-shadow,transform] duration-200 ease-[var(--ease)] disabled:opacity-45 disabled:pointer-events-none select-none active:translate-y-px";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-bg hover:bg-ink/85",
  secondary: "bg-surface text-ink border border-line hover:border-ink/30 hover:bg-bg",
  ghost: "text-ink-2 hover:text-ink hover:bg-ink/5",
  accent: "bg-accent text-white hover:bg-accent-ink",
  danger: "bg-danger text-white hover:opacity-90",
  panel: "bg-white/8 text-panel-ink border border-panel-line hover:bg-white/14",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-lg",
  md: "h-10 px-4 text-[14px] rounded-[10px]",
  lg: "h-12 px-6 text-[15px] rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
});

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
