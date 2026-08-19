import { useState, useRef, useEffect, useCallback } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScriptState } from "@/hooks/use-studio-store";

interface SetupPanelProps {
  script: ScriptState;
  onScriptChange: (updates: Partial<ScriptState>) => void;
  referenceImage: string | null;
  onReferenceImageChange: (dataUrl: string | null) => void;
}

export function SetupPanel({ script, onScriptChange, referenceImage, onReferenceImageChange }: SetupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setUploadError("Choose a JPEG or PNG reference image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("Reference images must be 10 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadError(null);
      onReferenceImageChange(dataUrl);
    };
    reader.readAsDataURL(file);
    
    // Reset so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveReference = () => {
    onReferenceImageChange(null);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="setup-panel">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-serif text-foreground">Scene Definition</h2>
          <p className="text-sm text-muted-foreground">Describe the scene you want to build. This helps ground the prompt.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scene-title">Title</Label>
          <Input 
            id="scene-title" 
            value={script.title} 
            onChange={(e) => onScriptChange({ title: e.target.value })}
            placeholder="e.g. A Quiet Morning"
            className="font-medium"
            data-testid="input-scene-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="visual-description">Visual Description</Label>
          <Textarea 
            id="visual-description" 
            value={script.visualDescription}
            onChange={(e) => onScriptChange({ visualDescription: e.target.value })}
            placeholder="Describe the mood, lighting, and composition..."
            className="min-h-[100px] resize-y"
            data-testid="textarea-visual-description"
          />
        </div>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-serif text-foreground">Generation Details</h2>
          <p className="text-sm text-muted-foreground">Fine-tune the exact prompt and constraints.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="generation-prompt">Final Prompt</Label>
          <Textarea 
            id="generation-prompt" 
            value={script.prompt}
            onChange={(e) => onScriptChange({ prompt: e.target.value })}
            placeholder="A highly detailed cinematic shot, moody lighting..."
            className="min-h-[120px] resize-y"
            data-testid="textarea-generation-prompt"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
            <Select 
              value={script.aspectRatio} 
              onValueChange={(value: any) => onScriptChange({ aspectRatio: value })}
            >
              <SelectTrigger id="aspect-ratio" data-testid="select-aspect-ratio">
                <SelectValue placeholder="Select ratio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                <SelectItem value="1:1">1:1 (Square)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="h-px w-full bg-border" />

      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif text-foreground">Reference Subject</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">Optional</span>
          </div>
          <p className="text-sm text-muted-foreground">Upload a photo to guide the generation.</p>
        </div>

        {!referenceImage ? (
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-8 hover:bg-muted/50 hover:border-primary/50 transition-colors group cursor-pointer"
            data-testid="button-upload-reference"
          >
            <div className="h-12 w-12 rounded-full bg-background flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Click to upload reference</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG or PNG, up to 10 MB</p>
              {uploadError && (
                <p className="text-xs text-destructive mt-2" data-testid="text-reference-upload-error">
                  {uploadError}
                </p>
              )}
            </div>
          </button>
        ) : (
          <div className="relative group rounded-xl overflow-hidden border border-border shadow-sm">
            <img 
              src={referenceImage} 
              alt="Reference" 
              className="w-full h-[240px] object-cover"
              data-testid="img-reference-preview"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                className="shadow-md"
                data-testid="button-change-reference"
              >
                Change
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleRemoveReference}
                className="shadow-md"
                data-testid="button-remove-reference"
              >
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            </div>
          </div>
        )}
        <input 
          type="file" 
          accept="image/jpeg,image/png" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
          data-testid="input-file-reference"
        />
      </div>
    </div>
  );
}
