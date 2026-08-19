import { useState } from "react";
import { Sparkles, Download, Check, AlertTriangle, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudioImage } from "@workspace/api-client-react";

interface ReviewPanelProps {
  currentImage: StudioImage | null;
  isGenerating: boolean;
  onGenerate: () => void;
  canGenerate: boolean;
  generationError?: string | null;
  aspectRatio: string;
}

import { InstagramPublishDialog } from "./instagram-publish-dialog";

export function ReviewPanel({ 
  currentImage, 
  isGenerating, 
  onGenerate, 
  canGenerate, 
  generationError,
  aspectRatio
}: ReviewPanelProps) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    if (!currentImage?.imageDataUrl) return;
    
    const a = document.createElement("a");
    a.href = currentImage.imageDataUrl;
    a.download = `curtis-studio-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  // Determine the container aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "9:16": return "aspect-[9/16]";
      case "1:1": return "aspect-square";
      case "16:9":
      default: return "aspect-video";
    }
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
        ) : currentImage ? (
          <div className="w-full h-full p-4 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            <div className={`relative w-full max-h-full flex items-center justify-center rounded-lg overflow-hidden flex-1`}>
              <img 
                src={currentImage.imageDataUrl} 
                alt="Generated scene" 
                className={`max-w-full max-h-full object-contain shadow-md rounded-md ${getAspectRatioClass()}`}
                data-testid="img-generated-result"
              />
            </div>
            <div className="flex items-center justify-between mt-4 bg-background border border-border rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono font-normal">
                  Provider: {currentImage.provider}
                </Badge>
                {currentImage.referenceUsed && (
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-normal">
                    Reference Applied
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <InstagramPublishDialog imageDataUrl={currentImage.imageDataUrl} />
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
