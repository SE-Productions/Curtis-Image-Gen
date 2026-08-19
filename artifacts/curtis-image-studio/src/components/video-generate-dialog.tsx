import { useState, useEffect } from "react";
import { 
  useStartStudioVideo, 
  useGetStudioVideo,
  getGetStudioVideoQueryKey,
  StudioVideoTask
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Download, Video, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface VideoGenerateDialogProps {
  imageDataUrl: string;
  prompt: string;
  format: "story" | "reel";
  trigger?: React.ReactNode;
}

export function VideoGenerateDialog({ imageDataUrl, prompt, format, trigger }: VideoGenerateDialogProps) {
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);

  const startMutation = useStartStudioVideo({
    mutation: {
      onSuccess: (data) => {
        setTaskId(data.taskId);
        toast.success("Video generation started");
      },
      onError: (err: any) => {
        toast.error("Failed to start video", { description: err.message });
      }
    }
  });

  const { data: task, refetch } = useGetStudioVideo(taskId!, {
    query: {
      queryKey: getGetStudioVideoQueryKey(taskId!),
      enabled: !!taskId,
      refetchInterval: (query) => {
        if (!query.state.data) return 3000;
        const status = query.state.data.status;
        return status === "completed" || status === "failed" ? false : 3000;
      }
    }
  });

  useEffect(() => {
    if (!open) {
      setTaskId(null);
    }
  }, [open]);

  const handleStart = () => {
    startMutation.mutate({
      data: {
        imageDataUrl,
        prompt,
        format,
        durationSeconds: 5
      }
    });
  };

  const handleDownload = () => {
    if (!task?.videoUrl) return;
    const a = document.createElement("a");
    a.href = task.videoUrl;
    a.download = `curtis-video-${taskId}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-md">
            <Play className="w-4 h-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Animate Scene
          </DialogTitle>
          <DialogDescription>
            Turn this static image into a 5-second animated video.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="aspect-square sm:aspect-[4/3] bg-muted rounded-md overflow-hidden relative">
            {task?.status === "completed" && task.videoUrl ? (
              <video 
                src={task.videoUrl} 
                className="w-full h-full object-cover" 
                controls 
                autoPlay 
                loop 
              />
            ) : (
              <img src={imageDataUrl} alt="Preview" className="w-full h-full object-cover opacity-50" />
            )}
            
            {(!task || task.status === "queued" || task.status === "processing") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/20 backdrop-blur-[2px]">
                {taskId ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium">
                      {task?.status === "processing" ? "Animating video..." : "Waiting in queue..."}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">This may take a minute or two</p>
                  </>
                ) : (
                  <Button onClick={handleStart} disabled={startMutation.isPending} className="shadow-lg">
                    {startMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                    Start Animation
                  </Button>
                )}
              </div>
            )}
          </div>

          {task?.status === "failed" && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Generation failed</AlertTitle>
              <AlertDescription>{task.error || "An unknown error occurred during animation."}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {task?.status === "completed" ? (
            <Button onClick={handleDownload} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Download Video
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {taskId ? "Run in background" : "Cancel"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
