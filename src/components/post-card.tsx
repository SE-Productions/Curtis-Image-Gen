import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, ImageOff, Instagram, Loader2, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StudioPost } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusTone: Record<
  StudioPost["status"],
  "muted" | "primary" | "ok" | "navy" | "danger"
> = {
  idea: "muted",
  generated: "navy",
  scheduled: "ok",
  publishing: "primary",
  published: "primary",
  failed: "danger",
};

export function PostCard({
  post,
  busy,
  identityLocked,
  nvidia,
  onRender,
  onPublish,
  onVideo,
  onDelete,
}: {
  post: StudioPost;
  busy?: boolean;
  identityLocked?: boolean;
  nvidia?: boolean;
  onRender?: () => void;
  onPublish?: () => void;
  onVideo?: () => void;
  onDelete?: () => void;
}) {
  const src = post.hasMedia ? `/api/media/${post.id}` : null;
  const statusLabel =
    post.status === "scheduled"
      ? "ready"
      : post.status === "idea"
        ? "draft"
        : post.status;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-square shrink-0 bg-bg sm:w-48">
          {src ? (
            <img src={src} alt={post.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-36 flex-col items-center justify-center gap-1 text-muted">
              <ImageOff className="size-5" />
              <span className="font-mono text-[10px] uppercase tracking-wider">No scene</span>
            </div>
          )}
          <div className="absolute left-2 top-2">
            <Badge tone="muted" className="bg-surface/90">
              {post.format}
            </Badge>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
                {format(parseISO(post.planDate), "EEEE d MMM")}
              </p>
              <h3 className="mt-0.5 font-serif text-xl leading-tight">{post.title}</h3>
            </div>
            <Badge tone={statusTone[post.status]}>{statusLabel}</Badge>
          </div>
          <p className="line-clamp-2 text-sm text-muted">{post.concept}</p>
          <div className="flex flex-wrap gap-1.5">
            {nvidia || post.director === "nvidia" ? (
              <Badge tone="nvidia">NVIDIA</Badge>
            ) : null}
            {identityLocked ? <Badge>Identity locked</Badge> : null}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {post.scheduledFor && post.status !== "published" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Clock className="size-3.5" />
                {format(parseISO(post.scheduledFor), "h:mm a")}
              </span>
            ) : null}
            {post.status === "published" ? (
              <span className="inline-flex items-center gap-1 text-xs text-ok">
                <CheckCircle2 className="size-3.5" />
                Posted
              </span>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-1.5">
              {onRender && post.status !== "published" ? (
                <Button size="sm" variant="outline" onClick={onRender} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  Render
                </Button>
              ) : null}
              {onVideo && post.hasMedia && post.format === "reel" && !post.videoUrl ? (
                <Button size="sm" variant="outline" onClick={onVideo} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <Play />}
                  Generate Reel
                </Button>
              ) : null}
              {onPublish && post.hasMedia && post.status !== "published" ? (
                <Button size="sm" onClick={onPublish} disabled={busy}>
                  <Instagram />
                  Post
                </Button>
              ) : null}
            </div>
          </div>
          {post.failureReason ? (
            <p className={cn("text-xs text-danger")}>{post.failureReason}</p>
          ) : null}
          {onDelete && !["published", "publishing"].includes(post.status) ? (
            <button
              type="button"
              onClick={onDelete}
              className="self-start text-xs text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
