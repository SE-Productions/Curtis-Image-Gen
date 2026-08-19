import { useState } from "react";
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
  getHealthCheckQueryKey,
  getGetStudioCapabilitiesQueryKey
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Camera, ServerCrash } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Home() {
  const { 
    script, 
    updateScript, 
    referenceImage, 
    setReferenceImage,
    history,
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

  const { data: health, isError: healthError } = useHealthCheck({
    query: { refetchInterval: 30000, queryKey: getHealthCheckQueryKey() }
  });
  
  const { data: capabilities } = useGetStudioCapabilities({
    query: { queryKey: getGetStudioCapabilitiesQueryKey() }
  });
  
  const generateMutation = useGenerateStudioImage();

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
          <div className="w-8 h-8 bg-foreground text-background flex items-center justify-center rounded-md">
            <Camera className="w-5 h-5" />
          </div>
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
              <Badge variant="outline" className="font-mono text-[10px] uppercase border-border">
                {capabilities.provider}
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
              canGenerate={isHealthy && script.prompt.trim().length > 0}
              generationError={generationError}
            />
          </div>
        </div>

        {/* History Area */}
        <HistoryGallery 
          items={history} 
          onDelete={deleteHistoryItem} 
          onSelect={handleSelectHistoryItem} 
        />
      </main>
    </div>
  );
}
