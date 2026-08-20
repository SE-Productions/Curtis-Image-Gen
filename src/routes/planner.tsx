import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PostCard } from "@/components/post-card";
import { deletePost, getStudioState, renderPost, renderPostVideo } from "@/lib/functions";
import { useStudioUi } from "@/lib/studio-store";
import type { StudioPost } from "@/lib/types";

export const Route = createFileRoute("/planner")({ component: PlannerPage });

function PlannerPage() {
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [nvidia, setNvidia] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const locked = Boolean(useStudioUi((s) => s.facePreview));

  async function refresh() {
    const state = await getStudioState();
    setPosts(state.posts);
    setNvidia(state.capabilities.nvidia);
  }

  useEffect(() => {
    void refresh().catch((error) =>
      toast.error(error instanceof Error ? error.message : "Could not load planner"),
    );
  }, []);

  return (
    <AppShell eyebrow="Content Planner" nvidia={nvidia}>
      <div className="mb-6">
        <h2 className="font-serif text-3xl tracking-tight">This week</h2>
        <p className="mt-1 text-sm text-muted">
          NVIDIA writes each scene from your topic, then we lock your face into the still.
        </p>
      </div>
      {posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-surface py-16 text-center">
          <Sparkles className="mb-3 size-8 text-muted" />
          <h2 className="font-serif text-2xl">No plan yet</h2>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Start on Create: photo, topic, fill calendar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <div key={post.id} className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
                Scene {index + 1}
              </p>
              <PostCard
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
                onVideo={async () => {
                  setBusyId(post.id);
                  try {
                    await renderPostVideo({
                      data: { id: post.id, publicOrigin: window.location.origin },
                    });
                    await refresh();
                    toast.success("Reel started");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Reel failed");
                  } finally {
                    setBusyId(null);
                  }
                }}
                onDelete={async () => {
                  await deletePost({ data: { id: post.id } });
                  await refresh();
                }}
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
