import { useState, useEffect } from "react";
import { Sparkles, Download, Check, AlertTriangle, Loader2, Image as ImageIcon, Film, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  StudioImage, 
  StudioImageInput, 
  useStartStudioVideo, 
  useGetStudioVideo, 
  getGetStudioVideoQueryKey 
} from "@workspace/api-client-react";
import { InstagramPublishDialog } from "./instagram-publish-dialog";
import { toast } from "sonner";

interface ReviewPanelProps {
  currentAsset: {
    image: StudioImage;
    input: StudioImageInput;
    title?: string;
    visualDescription?: string;
  } | null;
  isGenerating: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  generationError?: string | null;
}

export function ReviewPanel({ 
  currentAsset, 
  isGenerating, 
  onGenerate, 
  canGenerate, 
  generationError,
}: ReviewPanelProps) {
  const [downloaded, setDownloaded] = useState(false);
  const startVideoMutation = useStartStudioVideo();
  const [videoTask, setVideoTask] = useState<{ taskId: string, format: 'reel'|'story' } | null>(null);

  // Determine the container aspect ratio class
  const getAspectRatioClass = (ratio?: string) => {
    switch (ratio) {
      case "9:16": return "aspect-[9/16]";
      case "1:1": return "aspect-square";
      case "16:9":
      default: return "aspect-video";
    }
  };

  useEffect(() => {
    setVideoTask(null);
  }, [currentAsset]);

  const { data: videoData } = useGetStudioVideo(
    videoTask?.taskId || "",
    {
      query: {
        enabled: !!videoTask?.taskId,
        queryKey: videoTask ? getGetStudioVideoQueryKey(videoTask.taskId) : [],
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === 'completed' || status === 'failed') return false;
          return 3000;
        }
      }
    }
  );

  const handleDownload = () => {
    if (!currentAsset?.image.imageDataUrl) return;
    
    const a = document.createElement("a");
    a.href = currentAsset.image.imageDataUrl;
    a.download = `curtis-studio-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleStartVideo = (format: 'reel' | 'story') => {
    if (!currentAsset?.image.imageDataUrl) return;
    
    startVideoMutation.mutate({
      data: {
        imageDataUrl: currentAsset.image.imageDataUrl,
        prompt: currentAsset.input.prompt,
        format,
        durationSeconds: 5,
      }
    }, {
      onSuccess: (data) => {
        setVideoTask({ taskId: data.taskId, format });
        toast.success(`Started rendering ${format}`);
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.error || error.message || "Failed to start video render.";
        toast.error("Video render failed", { description: msg });
      }
    });
  };

  return (
    <div className="flex flex-col h-full" data-testid="review-panel">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-serif text-foreground">Studio Canvas</h2>
          <p className="text-sm text-muted-foreground">Preview and generate your scene.</p>
        </div>
        <Button 
          onClick={onGenerate} 
          disabled={!canGenerate || isGenerating}
          className="gap-2 shadow-sm font-medium"
          size="lg"
          data-testid="button-generate"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Scene
            </>
          )}
        </Button>
      </div>

      <Card className="flex-1 min-h-[400px] flex flex-col items-center justify-center bg-card border-card-border overflow-hidden relative shadow-sm">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
              <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center relative shadow-sm border border-border">
                <Sparkles className="w-6 h-6 text-primary animate-pulse" />
              </div>
            </div>
            <h3 className="font-serif text-2xl text-foreground mb-2">Composing your scene</h3>
            <p className="text-muted-foreground max-w-sm">
              Applying reference guidance, rendering details, and matching your stylistic instructions. This will take a few moments.
            </p>
          </div>
        ) : currentAsset ? (
          <div className="w-full h-full p-4 flex flex-col animate-in fade-in zoom-in-95 duration-300 overflow-y-auto">
            <div className={`relative w-full flex items-center justify-center rounded-lg overflow-hidden shrink-0 min-h-[300px]`}>
              <img 
                src={currentAsset.image.imageDataUrl} 
                alt="Generated scene" 
                className={`max-w-full max-h-[500px] object-contain shadow-md rounded-md ${getAspectRatioClass(currentAsset.input.aspectRatio)}`}
                data-testid="img-generated-result"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between mt-4 bg-background border border-border rounded-lg p-3 shadow-sm gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="font-mono font-normal">
                  Provider: {currentAsset.image.provider}
                </Badge>
                <Badge variant="outline" className="font-mono font-normal capitalize">
                  Fidelity: {currentAsset.image.fidelity}
                </Badge>
                {currentAsset.image.referenceUsed && (
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-normal">
                    Ref Applied
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <InstagramPublishDialog 
                  imageDataUrl={currentAsset.image.imageDataUrl} 
                  context={{
                    title: currentAsset.title,
                    visualDescription: currentAsset.visualDescription,
                    prompt: currentAsset.input.prompt,
                    aspectRatio: currentAsset.input.aspectRatio,
                  }}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownload}
                  className="gap-2"
                  data-testid="button-download"
                >
                  {downloaded ? (
                    <><Check className="w-4 h-4 text-green-500" /> Saved</>
                  ) : (
                    <><Download className="w-4 h-4" /> Download</>
                  )}
                </Button>
              </div>
            </div>

            {/* Video Rendering Section */}
            <div className="mt-4 pt-4 border-t border-border shrink-0">
              {videoTask ? (
                <div className="w-full border border-border rounded-lg p-4 bg-muted/30">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium flex items-center gap-2 text-sm">
                      <Film className="w-4 h-4" /> 
                      {videoTask.format === 'reel' ? 'Reel' : 'Story'} Render
                    </h4>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {videoData?.status || 'starting'}
                    </Badge>
                  </div>
                  
                  {(!videoData || videoData.status === 'queued' || videoData.status === 'processing') && (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                      <p className="text-sm text-muted-foreground text-center">
                        {videoData?.status === 'processing' ? 'Rendering motion and preserving faces...' : 'Waiting in queue...'}
                      </p>
                    </div>
                  )}

                  {videoData?.status === 'failed' && (
                    <div className="flex flex-col items-center justify-center py-6 text-destructive">
                      <AlertTriangle className="w-8 h-8 mb-2" />
                      <p className="text-sm">Video rendering failed.</p>
                      {videoData.error && <p className="text-xs mt-1 opacity-80">{videoData.error}</p>}
                      <Button variant="outline" size="sm" className="mt-4" onClick={() => setVideoTask(null)}>
                        Clear
                      </Button>
                    </div>
                  )}

                  {videoData?.status === 'completed' && videoData.videoUrl && (
                    <div className="flex flex-col gap-4">
                      <div className="relative aspect-[9/16] w-[200px] sm:w-[240px] mx-auto bg-black rounded-md overflow-hidden shadow-md">
                        <video 
                          src={videoData.videoUrl} 
                          controls 
                          autoPlay 
                          loop 
                          muted 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="flex justify-center gap-3 mt-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          const a = document.createElement("a");
                          a.href = videoData.videoUrl!;
                          a.download = `curtis-${videoTask.format}-${Date.now()}.mp4`;
                          a.click();
                        }}>
                          <Download className="w-4 h-4 mr-2" /> Download MP4
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setVideoTask(null)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full flex gap-3 justify-start">
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleStartVideo('reel')} 
                    className="gap-2 text-xs"
                    disabled={startVideoMutation.isPending}
                  >
                    {startVideoMutation.isPending && startVideoMutation.variables?.data.format === 'reel' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Film className="w-3 h-3" />
                    )}
                    Generate Reel
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleStartVideo('story')} 
                    className="gap-2 text-xs"
                    disabled={startVideoMutation.isPending}
                  >
                    {startVideoMutation.isPending && startVideoMutation.variables?.data.format === 'story' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Smartphone className="w-3 h-3" />
                    )}
                    Generate Story
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : generationError ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="font-medium text-foreground mb-2 text-lg">Generation Failed</h3>
            <p className="text-muted-foreground max-w-sm">{generationError}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
              <ImageIcon className="w-6 h-6 opacity-50" />
            </div>
            <h3 className="font-serif text-2xl text-foreground mb-2">Ready to Render</h3>
            <p className="max-w-sm text-sm">
              Fill out your scene description, prompt, and optional reference image on the left, then click Generate to create your first visual.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
