import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStudioStore, HistoryItem } from "@/hooks/use-studio-store";
import { SetupPanel } from "@/components/setup-panel";
import { ReviewPanel } from "@/components/review-panel";
import { HistoryGallery } from "@/components/history-gallery";
import { 
  useGenerateStudioImage, 
  useGetStudioCapabilities, 
  useHealthCheck, 
  StudioImage,
  StudioImageInput,
  useCreateStudioSession,
  useGetStudioSession,
  getHealthCheckQueryKey,
  getGetStudioCapabilitiesQueryKey,
  getGetStudioScenesQueryKey,
  getGetStudioSessionQueryKey,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { LockKeyhole, ServerCrash, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrandMark } from "@/components/brand-mark";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const queryClient = useQueryClient();
  const { 
    script, 
    updateScript, 
    referenceImage, 
    setReferenceImage,
    history,
    historyLoading,
    addHistoryItem,
    deleteHistoryItem
  } = useStudioStore();

  const [currentAsset, setCurrentAsset] = useState<{
    image: StudioImage;
    input: StudioImageInput;
    title?: string;
    visualDescription?: string;
  } | null>(null);
  
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [accessPassword, setAccessPassword] = useState("");

  const { data: health, isError: healthError } = useHealthCheck({
    query: { refetchInterval: 30000, queryKey: getHealthCheckQueryKey() }
  });
  
  const { data: capabilities } = useGetStudioCapabilities({
    query: { queryKey: getGetStudioCapabilitiesQueryKey() }
  });
  
  const { data: studioSession, isLoading: sessionLoading } = useGetStudioSession({
    query: { retry: false, queryKey: getGetStudioSessionQueryKey() },
  });

  const generateMutation = useGenerateStudioImage();
  const unlockMutation = useCreateStudioSession({
    mutation: {
      onSuccess: () => {
        setAccessPassword("");
        queryClient.invalidateQueries({
          queryKey: getGetStudioSessionQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetStudioScenesQueryKey(),
        });
        toast.success("Studio unlocked");
      },
      onError: () => {
        toast.error("That access password is not correct.");
      },
    },
  });

  const studioLocked =
    studioSession?.required === true && studioSession.unlocked !== true;

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessPassword) return;
    unlockMutation.mutate({ data: { password: accessPassword } });
  };

  const handleGenerate = () => {
    if (!script.prompt.trim()) {
      toast.error("Prompt is required to generate an image.");
      return;
    }

    setGenerationError(null);
    const input: StudioImageInput = {
      prompt: script.prompt.trim(),
      aspectRatio: script.aspectRatio,
      referenceImage: referenceImage || undefined,
      fidelity: script.fidelity,
    };

    generateMutation.mutate({ data: input }, {
      onSuccess: (data) => {
        setCurrentAsset({
          image: data,
          input,
          title: script.title,
          visualDescription: script.visualDescription
        });
        addHistoryItem(input, data);
        toast.success("Scene generated successfully!");
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.error || error.message || "Failed to generate image.";
        setGenerationError(msg);
        toast.error("Generation failed", { description: msg });
      }
    });
  };

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setCurrentAsset({
      image: item.output,
      input: item.input,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isHealthy = health?.status === "ok" && !healthError;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/20" data-testid="page-home">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark className="w-10 h-10 shrink-0 drop-shadow-sm" />
          <div>
            <h1 className="font-serif text-xl leading-none text-foreground tracking-wide">Curtis Image Studio</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">
              Creative Visual Workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {capabilities && (
            <div className="hidden md:flex items-center gap-2 mr-4">
              {capabilities.provider.includes("NVIDIA") && (
                <Badge
                  className="font-mono text-[10px] uppercase gap-1 bg-[#76b900] hover:bg-[#76b900] text-white border-0"
                >
                  <Cpu className="w-2.5 h-2.5" />
                  NVIDIA
                </Badge>
              )}
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-border">
                {capabilities.provider.includes("NVIDIA")
                  ? capabilities.provider.replace(" + NVIDIA cinematic direction", "")
                  : capabilities.provider}
              </Badge>
              {capabilities.referenceGuidance && (
                <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                  Ref-Guidance: ON
                </Badge>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-2 text-xs font-medium border border-border px-3 py-1.5 rounded-full bg-card">
            {isHealthy ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-foreground">System Online</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span className="text-destructive">System Offline</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full flex flex-col">
        {!isHealthy && (
          <Alert variant="destructive" className="mb-8">
            <ServerCrash className="h-4 w-4" />
            <AlertTitle>API Unreachable</AlertTitle>
            <AlertDescription>
              Cannot connect to the generation service. Make sure the API server is running.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 flex-1">
          {/* Left Column: Setup */}
          <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
            <SetupPanel 
              script={script}
              onScriptChange={updateScript}
              referenceImage={referenceImage}
              onReferenceImageChange={setReferenceImage}
            />
          </div>

          {/* Right Column: Review */}
          <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
            <ReviewPanel 
              currentAsset={currentAsset}
              isGenerating={generateMutation.isPending}
              onGenerate={handleGenerate}
              canGenerate={
                isHealthy &&
                !sessionLoading &&
                !studioLocked &&
                script.prompt.trim().length > 0
              }
              generationError={generationError}
            />
          </div>
        </div>

        {/* History Area */}
        <HistoryGallery 
          items={history}
          isLoading={historyLoading}
          onDelete={deleteHistoryItem} 
          onSelect={handleSelectHistoryItem} 
        />
      </main>

      <Dialog open={studioLocked}>
        <DialogContent
          className="max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <DialogTitle>Unlock Curtis Image Studio</DialogTitle>
            <DialogDescription>
              Enter the operator access password to view and save the private Studio Album.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUnlock} className="space-y-4">
            <Input
              autoFocus
              type="password"
              autoComplete="current-password"
              placeholder="Access password"
              value={accessPassword}
              onChange={(event) => setAccessPassword(event.target.value)}
              disabled={unlockMutation.isPending}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={!accessPassword || unlockMutation.isPending}
            >
              {unlockMutation.isPending ? "Unlocking…" : "Unlock Studio"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
