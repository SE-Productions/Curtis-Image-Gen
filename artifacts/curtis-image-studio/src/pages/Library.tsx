import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetStudioScenes, 
  getGetStudioScenesQueryKey,
  useDeleteStudioScene,
  useGetContentPlan,
  getGetContentPlanQueryKey,
  useGetStudioSession,
  getGetStudioSessionQueryKey,
} from "@workspace/api-client-react";
import { VideoGenerateDialog } from "@/components/video-generate-dialog";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Download, Trash2, Clock, ImageIcon, Loader2, Play } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { StudioNavigation } from "@/components/studio-navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InstagramPublishDialog } from "@/components/instagram-publish-dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { getCurrentWeekStart } from "@/lib/date-utils";

export default function Library() {
  const queryClient = useQueryClient();
  const weekStart = getCurrentWeekStart();
  const { data: studioSession, isLoading: sessionLoading } = useGetStudioSession({
    query: { retry: false, queryKey: getGetStudioSessionQueryKey() },
  });
  const canLoadStudio =
    studioSession?.unlocked === true || studioSession?.required === false;

  const { data: scenes, isLoading } = useGetStudioScenes({
    query: {
      enabled: canLoadStudio,
      queryKey: getGetStudioScenesQueryKey(),
    }
  });
  const { data: planResult } = useGetContentPlan(
    { weekStart },
    {
      query: {
        enabled: canLoadStudio,
        queryKey: getGetContentPlanQueryKey({ weekStart }),
      },
    },
  );
  const workflowItems = planResult?.plan?.items ?? [];

  const deleteSceneMutation = useDeleteStudioScene({
    mutation: {
      onSuccess: () => {
        toast.success("Scene deleted");
        queryClient.invalidateQueries({ queryKey: getGetStudioScenesQueryKey() });
      },
      onError: (err: any) => {
        toast.error("Failed to delete scene", { description: err.message });
      }
    }
  });

  const handleDownload = (url: string, id: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `curtis-scene-${id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-[100dvh] bg-background selection:bg-primary/20 flex flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-10 w-10 shrink-0 drop-shadow-sm" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg leading-none tracking-wide text-foreground sm:text-xl">
              Curtis Image Studio
            </h1>
            <p className="mt-1 hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
              Scene Library
            </p>
          </div>
        </div>
        <StudioNavigation active="library" />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-foreground">Studio Library</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Persistent scenes and this week&apos;s real content workflow.
            </p>
          </div>
        </div>

        {!sessionLoading && !canLoadStudio ? (
          <Card className="border-amber-200 bg-amber-50/70 p-6 text-center">
            <h3 className="font-medium text-foreground">Unlock the private Library</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your generated scenes and workflow status are visible only after unlocking the studio.
            </p>
            <Link href="/settings" className="mt-4 inline-flex">
              <Button>Open Settings</Button>
            </Link>
          </Card>
        ) : (
          <>
        {workflowItems.length > 0 && (
          <section className="mb-10" aria-labelledby="workflow-library-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 id="workflow-library-heading" className="font-serif text-2xl text-foreground">
                  Content workflow
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ideas only move forward after you approve a generated scene.
                </p>
              </div>
              <Link href="/planner">
                <Button variant="outline" size="sm">Review plan</Button>
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {workflowItems.map((item) => {
                const selectedVariation = item.variations.find(
                  (variation) => variation.sceneId === item.selectedSceneId,
                );
                return (
                  <Card key={item.id} className="overflow-hidden border-border bg-card">
                    <div className="relative aspect-[4/3] bg-muted">
                      {selectedVariation ? (
                        <img
                          src={selectedVariation.imageDataUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ImageIcon className="h-7 w-7 opacity-40" />
                          <span className="text-xs">No approved scene yet</span>
                        </div>
                      )}
                      <div className="absolute left-2 top-2 flex gap-1">
                        <Badge variant="secondary" className="bg-background/90 font-mono text-[10px] uppercase backdrop-blur">
                          {item.format}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-border bg-background/90 text-[10px] uppercase backdrop-blur"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2 p-3">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.concept}</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                        <span>{item.planDate}</span>
                        <span>{item.variations.length} variation{item.variations.length === 1 ? "" : "s"}</span>
                      </div>
                      {item.failureReason && (
                        <p className="line-clamp-2 text-xs text-destructive">{item.failureReason}</p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading your library...</p>
          </div>
        ) : !scenes || scenes.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center border border-border border-dashed rounded-xl bg-card">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-serif text-foreground">Library Empty</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Generate scenes in the Studio or Planner to see them appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {scenes.map((scene) => (
              <Card key={scene.id} className="overflow-hidden group flex flex-col bg-card border-card-border shadow-sm hover:shadow-md transition-shadow">
                <div className="relative aspect-square bg-muted">
                  <img 
                    src={scene.imageDataUrl} 
                    alt={scene.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                    <InstagramPublishDialog 
                      imageDataUrl={scene.imageDataUrl}
                      context={{
                        prompt: scene.prompt,
                        aspectRatio: scene.aspectRatio,
                      }}
                    />
                    <VideoGenerateDialog
                      imageDataUrl={scene.imageDataUrl}
                      prompt={scene.prompt}
                      format={scene.aspectRatio === "9:16" ? "story" : "reel"}
                      trigger={
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              className="h-8 w-8 rounded-full shadow-md"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Animate</TooltipContent>
                        </Tooltip>
                      }
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-8 w-8 rounded-full shadow-md"
                          onClick={() => handleDownload(scene.imageDataUrl, scene.id)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8 rounded-full shadow-md"
                          onClick={() => deleteSceneMutation.mutate({ sceneId: scene.id })}
                          disabled={deleteSceneMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono shadow-sm bg-background/90 backdrop-blur">
                      {scene.provider}
                    </Badge>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-xs font-medium text-foreground line-clamp-3 leading-relaxed mb-3 flex-1" title={scene.prompt}>
                    {scene.prompt}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-auto">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{scene.aspectRatio}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(parseISO(scene.createdAt))}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}
