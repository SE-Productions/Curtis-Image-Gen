import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "primary" | "ok" | "navy" | "nvidia" | "danger";
}) {
  const tones = {
    muted: "bg-bg text-muted",
    primary: "bg-primary/12 text-primary",
    ok: "bg-ok/12 text-ok",
    navy: "bg-navy text-navy-fg",
    nvidia: "bg-nvidia text-primary-fg",
    danger: "bg-danger/12 text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
