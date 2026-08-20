import { Link, useRouterState } from "@tanstack/react-router";
import {
  Aperture,
  CalendarDays,
  Cpu,
  Images,
  LockKeyhole,
  Settings,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useStudioUi } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Create", icon: Aperture },
  { to: "/planner", label: "Planner", icon: Sparkles },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/library", label: "Library", icon: Images },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({
  children,
  eyebrow,
  title,
  wide,
  nvidia,
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
  wide?: boolean;
  nvidia?: boolean;
}) {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const facePreview = useStudioUi((s) => s.facePreview);
  const locked = Boolean(facePreview);

  return (
    <div className="min-h-dvh bg-bg pb-24 text-fg md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="size-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-serif text-lg leading-none tracking-wide sm:text-xl">
                Curtis Image Studio
              </p>
              <p className="mt-1 hidden text-[10px] uppercase tracking-[0.18em] text-muted sm:block">
                {eyebrow ?? "Creative Visual Workspace"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {locked ? (
              <Badge tone="muted" className="hidden sm:inline-flex">
                <LockKeyhole className="size-3" />
                Identity locked
              </Badge>
            ) : null}
            {nvidia ? (
              <Badge tone="nvidia" className="hidden sm:inline-flex">
                <Cpu className="size-3" />
                NVIDIA
              </Badge>
            ) : null}
            <nav
              aria-label="Studio"
              className="hidden items-center gap-1 rounded-lg border border-border bg-surface p-1 lg:flex"
            >
              {tabs.map((tab) => {
                const active =
                  tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={cn(
                      "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium",
                      active
                        ? "bg-primary text-primary-fg"
                        : "text-muted hover:bg-bg hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden xl:inline">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
            {isPending ? (
              <div className="h-8 w-16 animate-pulse rounded-full bg-secondary" />
            ) : user ? (
              <UserButton />
            ) : (
              <Link
                to="/login"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-fg"
              >
                
              </Link>
            )}
          </div>
        </div>
      </header>

      {title ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
          <h1 className="font-serif text-3xl tracking-tight">{title}</h1>
        </div>
      ) : null}

      <main
        className={cn(
          "mx-auto w-full px-4 py-4 sm:px-6 sm:py-8",
          wide ? "max-w-[1600px]" : "max-w-5xl",
        )}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-fg/10 bg-navy pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((tab) => {
            const active =
              tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium tracking-wide",
                  active ? "text-primary" : "text-navy-fg/55",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
