import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { asDay, formatDay } from "@/lib/dates";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import {
  deletePost,
  getStudioState,
  publishNow,
  renderPost,
  runDuePublishes,
} from "@/lib/functions";
import { useStudioUi } from "@/lib/studio-store";
import type { StudioPost } from "@/lib/types";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [nvidia, setNvidia] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rendering = useRef(false);
  const locked = Boolean(useStudioUi((s) => s.facePreview));

  async function refresh() {
    const state = await getStudioState();
    setPosts(state.posts);
    setNvidia(state.capabilities.nvidia);
  }

  useEffect(() => {
    void refresh()
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load calendar"),
      )
      .finally(() => setLoading(false));
    void runDuePublishes({ data: { publicOrigin: window.location.origin } }).then((r) => {
      if (r.published) void refresh();
    });
  }, []);

  useEffect(() => {
    if (rendering.current) return;
    const next = posts.find((p) => p.status === "idea");
    if (!next) return;
    rendering.current = true;
    setBusyId(next.id);
    void renderPost({ data: { id: next.id } })
      .then(() => refresh())
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Render failed"),
      )
      .finally(() => {
        rendering.current = false;
        setBusyId(null);
      });
  }, [posts]);

  const grouped = posts.reduce<Record<string, StudioPost[]>>((acc, post) => {
    (acc[asDay(post.planDate)] ??= []).push(post);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();
  const weekLabel = dates[0]
    ? `Week of ${formatDay(dates[0], "MMM d")}`
    : null;

  return (
    <AppShell eyebrow="Content Calendar" nvidia={nvidia}>
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Weekly Calendar</h2>
          <p className="mt-1 text-sm text-muted">
            One post per day. Due items publish automatically when Instagram is connected.
          </p>
        </div>
        {weekLabel ? (
          <div className="rounded-lg border border-border bg-secondary px-4 py-2">
            <p className="text-xs font-medium">{weekLabel}</p>
          </div>
        ) : null}
      </div>
      {loading ? (
        <p className="py-16 text-center text-sm text-muted">Loading calendar…</p>
      ) : dates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <CalendarDays className="mb-3 size-8 text-muted" />
          <h2 className="font-serif text-2xl">No content planned</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Add a face and a topic on Create, then fill the calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <section key={date} className="flex flex-col gap-4 md:flex-row md:gap-6">
              <div className="md:w-32 md:shrink-0 md:pt-2">
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted">
                  {formatDay(date, "EEEE")}
                </p>
                <p className="mt-1 font-serif text-3xl leading-none">
                  {formatDay(date, "d")}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                {grouped[date].map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    busy={busyId === post.id}
                    identityLocked={locked}
                    nvidia={nvidia || post.director === "nvidia"}
                    onRender={async () => {
                      setBusyId(post.id);
                      try {
                        await renderPost({ data: { id: post.id } });
                        await refresh();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Render failed");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    onPublish={async () => {
                      setBusyId(post.id);
                      try {
                        await publishNow({
                          data: { id: post.id, publicOrigin: window.location.origin },
                        });
                        await refresh();
                        toast.success("Posted to Instagram");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Publish failed");
                        await refresh();
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    onDelete={async () => {
                      await deletePost({ data: { id: post.id } });
                      await refresh();
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
