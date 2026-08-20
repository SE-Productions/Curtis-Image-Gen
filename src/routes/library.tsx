import { createFileRoute } from "@tanstack/react-router";
import { formatDay } from "@/lib/dates";
import { Images } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { getStudioState } from "@/lib/functions";
import type { StudioPost } from "@/lib/types";

export const Route = createFileRoute("/library")({ component: LibraryPage });

function LibraryPage() {
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [nvidia, setNvidia] = useState(false);

  useEffect(() => {
    void getStudioState()
      .then((s) => {
        setPosts(s.posts.filter((p) => p.hasMedia));
        setNvidia(s.capabilities.nvidia);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load library"),
      );
  }, []);

  return (
    <AppShell eyebrow="Library" nvidia={nvidia}>
      <div className="mb-6">
        <h2 className="font-serif text-3xl tracking-tight">Rendered stills</h2>
        <p className="mt-1 text-sm text-muted">Face-locked scenes from this week’s plan.</p>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <Images className="mb-3 size-8 text-muted" />
          <h2 className="font-serif text-2xl">Nothing rendered yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Fill the calendar from Create to generate face-locked stills.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((post) => (
            <figure key={post.id} className="overflow-hidden rounded-lg bg-surface shadow-(--shadow-card)">
              <img
                src={`/api/media/${post.id}`}
                alt={post.title}
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="space-y-1 p-3">
                <p className="truncate text-sm font-medium">{post.title}</p>
                <p className="text-[11px] text-muted">
                  {formatDay(post.planDate, "MMM d")}
                </p>
                <Badge tone={post.status === "published" ? "ok" : "muted"}>
                  {post.status === "scheduled" ? "ready" : post.status}
                </Badge>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </AppShell>
  );
}
