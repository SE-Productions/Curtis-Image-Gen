import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  clearFace,
  fillCalendar,
  getCapabilities,
  getFaceData,
  getStudioState,
  saveFace,
} from "@/lib/functions";
import { useStudioUi } from "@/lib/studio-store";
import type { StudioCapabilities, StudioPost } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: CreatePage });

function CreatePage() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caps, setCaps] = useState<StudioCapabilities | null>(null);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [hasFace, setHasFace] = useState(false);
  const {
    topic,
    setTopic,
    days,
    setDays,
    format,
    setFormat,
    facePreview,
    setFacePreview,
    filling,
    setFilling,
  } = useStudioUi();

  useEffect(() => {
    void getCapabilities()
      .then(setCaps)
      .catch(() => {});
    if (isPending || !user) return;
    void getStudioState()
      .then((state) => {
        setCaps(state.capabilities);
        setPosts(state.posts);
        setHasFace(Boolean(state.face));
        setFormat(state.settings.format);
        if (state.settings.days === 3 || state.settings.days === 14) {
          setDays(state.settings.days);
        }
      })
      .catch(() => {});
    void getFaceData()
      .then((r) => {
        if (r.dataUrl) {
          setFacePreview(r.dataUrl);
          setHasFace(true);
        }
      })
      .catch(() => {});
  }, [isPending, user, setDays, setFacePreview, setFormat]);

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Use a JPEG or PNG");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Keep the photo under 6 MB");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the photo"));
      reader.readAsDataURL(file);
    });
    setFacePreview(dataUrl);
    try {
      await saveFace({ data: { dataUrl } });
      setHasFace(true);
      toast.success("Identity locked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the photo");
    }
  }

  async function onFill() {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!hasFace && !facePreview) {
      toast.error("Add a face photo first");
      return;
    }
    if (!topic.trim()) {
      toast.error("Add a topic");
      return;
    }
    setFilling(true);
    try {
      const result = await fillCalendar({
        data: { topic: topic.trim(), days, format },
      });
      setPosts(result.posts);
      toast.success(
        result.director === "nvidia"
          ? "NVIDIA wrote the week"
          : "Cinematic week is on the calendar",
      );
      navigate({ to: "/calendar" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not fill the calendar");
    } finally {
      setFilling(false);
    }
  }

  const latest = [...posts].reverse().find((p) => p.hasMedia) ?? null;
  const sceneSrc = latest ? `/api/media/${latest.id}` : facePreview;

  return (
    <AppShell eyebrow="Creative Visual Workspace" wide nvidia={caps?.nvidia}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <section className="flex flex-col gap-5 lg:col-span-4 xl:col-span-3">
          <div>
            <h2 className="font-serif text-2xl">The Prompt</h2>
            <p className="mt-1 text-sm text-muted">
              Lock a face. Name a topic. NVIDIA writes ultra-realistic scenes with true
              fidelity. One Instagram post a day.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Face reference</Label>
              {facePreview ? (
                <button
                  type="button"
                  className="text-xs text-primary"
                  onClick={() => {
                    setFacePreview(null);
                    setHasFace(false);
                    if (user) void clearFace();
                  }}
                >
                  Remove
                </button>
              ) : null}
            </div>
            {facePreview ? (
              <div className="relative overflow-hidden rounded-xl">
                <img src={facePreview} alt="Locked face" className="h-52 w-full object-cover" />
                <Badge className="absolute left-3 top-3 bg-surface/90" tone="muted">
                  Face lock
                </Badge>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-4 text-left shadow-(--shadow-card)"
              >
                <span className="grid size-12 place-items-center rounded-full bg-secondary text-primary">
                  <Upload className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-medium">Choose a face photo</span>
                  <span className="block text-xs text-muted">
                    JPG or PNG · identity lock · 6 MB max
                  </span>
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={(e) => void onPick(e.target.files?.[0])}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="A week of quiet coastal mornings, linen wardrobe, golden hour light…"
            />
          </div>

          <div className="space-y-2">
            <Label>Days</Label>
            <div className="grid grid-cols-3 gap-2">
              {([3, 7, 14] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDays(n)}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium",
                    days === n
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border bg-surface text-fg",
                  )}
                >
                  {n} days
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["feed", "Feed"],
                  ["story", "Story"],
                  ["reel", "Reel"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormat(value)}
                  className={cn(
                    "h-11 rounded-md border text-sm font-medium",
                    format === value
                      ? "border-navy bg-navy text-navy-fg"
                      : "border-border bg-surface text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg" disabled={filling} onClick={() => void onFill()}>
            {filling ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {filling ? "Writing the week…" : "Fill the calendar"}
          </Button>
        </section>

        <section className="flex flex-col lg:col-span-8 xl:col-span-9">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">The Scene</h2>
              <p className="mt-1 text-sm text-muted">
                Face-locked stills land here, then fill the week.
              </p>
            </div>
            {caps?.nvidia ? (
              <Badge tone="nvidia">NVIDIA</Badge>
            ) : caps?.grok ? (
              <Badge tone="navy">Director on</Badge>
            ) : null}
          </div>

          <Card className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-hidden">
            {filling ? (
              <div className="px-8 py-16 text-center">
                <div className="mx-auto mb-5 grid size-16 place-items-center rounded-full border border-border bg-bg">
                  <Sparkles className="size-6 animate-pulse text-primary" />
                </div>
                <h3 className="font-serif text-2xl">Composing your week</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  NVIDIA is writing ultra-realistic scenes from the locked face, then the
                  calendar fills one post per day.
                </p>
              </div>
            ) : sceneSrc ? (
              <div className="relative h-full w-full">
                <img
                  src={sceneSrc}
                  alt={latest?.title ?? "Identity lock"}
                  className="h-full max-h-[640px] w-full object-cover"
                />
                <Badge className="absolute left-4 top-4 bg-surface/90" tone="muted">
                  Face lock
                </Badge>
                <div className="absolute inset-x-0 bottom-0 bg-navy/80 px-4 py-3 text-navy-fg">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-navy-fg/70">
                    Identity locked
                  </p>
                  <p className="font-serif text-lg leading-tight">
                    {latest?.title ?? "Reference ready"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-8 py-16 text-center">
                <h3 className="font-serif text-2xl">Waiting for a scene</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  Add a face photo and a topic, then fill the calendar. NVIDIA writes the
                  description. Stills render with true face fidelity.
                </p>
              </div>
            )}
          </Card>

          {posts.length > 0 ? (
            <p className="mt-4 text-sm text-muted">
              {posts.filter((p) => p.status === "scheduled" || p.status === "generated").length}{" "}
              ready · {posts.filter((p) => p.status === "published").length} posted · one
              Instagram drop per day
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
