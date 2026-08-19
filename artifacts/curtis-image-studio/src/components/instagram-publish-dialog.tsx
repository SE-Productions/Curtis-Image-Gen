import { useState, useEffect } from "react";
import { Loader2, Instagram, Settings, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { 
  useGetInstagramPublishingStatus, 
  getGetInstagramPublishingStatusQueryKey,
  usePublishStudioImageToInstagram,
  useGenerateStudioPostCopy,
  StudioPostCopyInputFormat
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InstagramPublishDialogProps {
  imageDataUrl: string;
  context?: {
    title?: string;
    visualDescription?: string;
    prompt: string;
    aspectRatio: string;
    initialCaption?: string;
  };
  trigger?: React.ReactNode;
  onPublished?: (postId: string) => void;
  onPublishFailed?: (message: string) => void;
}

export function InstagramPublishDialog({
  imageDataUrl,
  context,
  trigger,
  onPublished,
  onPublishFailed,
}: InstagramPublishDialogProps) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  
  // Publication state
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishStatus, setPublishStatus] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);
  
  const {
    data: status,
    isLoading: isLoadingStatus,
    isFetching: isFetchingStatus,
    refetch: refetchStatus,
  } = useGetInstagramPublishingStatus({
    query: {
      enabled: open,
      queryKey: getGetInstagramPublishingStatusQueryKey()
    }
  });

  const publishMutation = usePublishStudioImageToInstagram();
  const generateCaptionMutation = useGenerateStudioPostCopy();

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setCaption(context?.initialCaption || "");
      setPublishSuccess(false);
      setPublishStatus("");
      setPublishError(null);
    }
  }, [open, context?.initialCaption]);

  const handleGenerateCaption = () => {
    if (!context) return;
    
    let format: StudioPostCopyInputFormat = 'feed';
    if (context.aspectRatio === '9:16') format = 'story'; // defaults to story/reel for vertical
    
    generateCaptionMutation.mutate({
      data: {
        title: context.title || undefined,
        visualDescription: context.visualDescription || undefined,
        prompt: context.prompt,
        format,
      }
    }, {
      onSuccess: (data) => {
        setCaption(data.caption);
        toast.success("Caption generated!");
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.error || "Failed to generate caption.";
        toast.error("Caption generation failed", { description: msg });
      }
    });
  };

  const handlePublish = () => {
    if (!imageDataUrl) return;
    setPublishError(null);
    
    publishMutation.mutate({
      data: {
        imageDataUrl,
        caption: caption.trim()
      }
    }, {
      onSuccess: (data) => {
        setPublishSuccess(true);
        setPublishStatus(data.status || "Published");
        if (onPublished && data.postId) {
          onPublished(data.postId);
        }
      },
      onError: (error: any) => {
        const msg = error?.response?.data?.error || error.message || "Failed to publish image.";
        
        // Handle 409 special case for deployment needed
        if (error?.response?.status === 409) {
          setPublishError("Instagram requires the application to be publicly deployed before it can fetch the image. Publishing is unavailable in local development.");
        } else {
          setPublishError(msg);
        }
        onPublishFailed?.(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2" data-testid="button-instagram-trigger">
            <Instagram className="w-4 h-4" />
            Publish
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-instagram-publish">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="w-5 h-5 text-pink-600 dark:text-pink-500" />
            Publish to Instagram
          </DialogTitle>
          <DialogDescription>
            Share your generated scene directly to your connected Instagram account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoadingStatus ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mb-4" />
              <p className="text-sm">Checking connection status...</p>
            </div>
          ) : publishSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95" data-testid="instagram-publish-success">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">Successfully Published</h3>
              <p className="text-sm text-muted-foreground mb-4">Your image has been shared to Instagram.</p>
              <Badge variant="outline" className="font-mono bg-background">
                Status: {publishStatus}
              </Badge>
            </div>
          ) : status?.connected !== true ? (
            <div className="flex flex-col gap-4 animate-in fade-in" data-testid="instagram-connection-flow">
              <div className="bg-muted/50 p-4 rounded-lg border border-border text-center">
                <Instagram className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <h4 className="font-medium text-foreground mb-1">
                  {status?.configured
                    ? "Instagram is not connected"
                    : "Instagram setup is incomplete"}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {status?.configured
                    ? "Connect or repair your Instagram account in Settings before publishing."
                    : "The protected Composio server configuration must be completed before an account can be connected."}
                </p>
                <div className="text-xs text-muted-foreground bg-background p-2 rounded border border-border inline-block mb-4">
                  Note: Instagram API requires a Business or Creator account.
                </div>

                <div className="flex flex-col justify-center gap-2 sm:flex-row">
                  <Button asChild className="gap-2" data-testid="button-instagram-open-settings">
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      Open Settings
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => refetchStatus()}
                    disabled={isFetchingStatus}
                    data-testid="button-instagram-refresh-status"
                  >
                    {isFetchingStatus && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Refresh status
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 animate-in fade-in" data-testid="instagram-publish-form">
              {publishError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Publishing Failed</AlertTitle>
                  <AlertDescription>{publishError}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="sm:col-span-2">
                  <div className="aspect-square bg-muted rounded-md overflow-hidden border border-border">
                    <img 
                      src={imageDataUrl} 
                      alt="Preview for Instagram" 
                      className="w-full h-full object-cover"
                      data-testid="img-instagram-preview"
                    />
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground flex justify-between items-center">
                    <span>Account: {status?.accountType || "Connected"}</span>
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckCircle className="w-3 h-3" /> Ready
                    </span>
                  </div>
                </div>
                
                <div className="sm:col-span-3 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="caption" className="text-sm font-medium">
                      Caption (Optional)
                    </label>
                    {context && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={handleGenerateCaption}
                        disabled={generateCaptionMutation.isPending}
                        data-testid="button-generate-caption"
                      >
                        {generateCaptionMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        {caption ? "Regenerate AI" : "Generate AI"}
                      </Button>
                    )}
                  </div>
                  <Textarea 
                    id="caption"
                    placeholder="Write a caption for your post..."
                    className="flex-1 min-h-[120px] resize-none"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={2200}
                    data-testid="textarea-instagram-caption"
                  />
                  <div className="text-xs text-muted-foreground mt-1 text-right">
                    {caption.length} / 2200
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {status?.available && !publishSuccess && (
          <DialogFooter className="sm:justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="button-instagram-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={publishMutation.isPending}
              className="gap-2 bg-pink-600 hover:bg-pink-700 text-white"
              data-testid="button-instagram-confirm-publish"
            >
              {publishMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Instagram className="w-4 h-4" />
                  Publish Now
                </>
              )}
            </Button>
          </DialogFooter>
        )}
        
        {publishSuccess && (
          <DialogFooter className="border-t border-border pt-4">
            <Button className="w-full" onClick={() => setOpen(false)} data-testid="button-instagram-close">
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
