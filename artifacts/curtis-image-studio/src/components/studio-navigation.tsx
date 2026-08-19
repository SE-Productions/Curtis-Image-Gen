import { ImageIcon, Settings } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function StudioNavigation({
  active,
}: {
  active: "studio" | "planner" | "library" | "calendar" | "settings";
}) {
  const itemClass =
    "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <nav
      aria-label="Studio navigation"
      className="flex items-center gap-1 rounded-lg border border-border bg-card p-1"
    >
      <Link
        href="/"
        className={cn(
          itemClass,
          active === "studio"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <ImageIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Studio</span>
      </Link>
      <Link
        href="/planner"
        className={cn(
          itemClass,
          active === "planner"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span className="hidden sm:inline">Planner</span>
      </Link>
      <Link
        href="/library"
        className={cn(
          itemClass,
          active === "library"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>
        <span className="hidden sm:inline">Library</span>
      </Link>
      <Link
        href="/calendar"
        className={cn(
          itemClass,
          active === "calendar"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span className="hidden sm:inline">Calendar</span>
      </Link>
      <Link
        href="/settings"
        className={cn(
          itemClass,
          active === "settings"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Settings</span>
      </Link>
    </nav>
  );
}