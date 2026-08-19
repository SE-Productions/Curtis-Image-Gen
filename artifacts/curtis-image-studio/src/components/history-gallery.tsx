import { formatDistanceToNow } from "date-fns";
import { Download, Trash2, Clock, ImageIcon, Instagram, Eye, Loader2 } from "lucide-react";
import { HistoryItem } from "@/hooks/use-studio-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InstagramPublishDialog } from "./instagram-publish-dialog";

interface HistoryGalleryProps {
  items: HistoryItem[];
  isLoading?: boolean;
  onDelete: (id: string) => void;
  onSelect: (item: HistoryItem) => void;
}

export function HistoryGallery({ items, isLoading, onDelete, onSelect }: HistoryGalleryProps) {
  if (isLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center border-t border-border mt-8" data-testid="history-loading">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" />
        <p className="text-sm text-muted-foreground">Loading your studio album…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center border-t border-border mt-8" data-testid="history-empty">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
        </div>
        <h3 className="font-medium text-foreground">No History Yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Your generated scenes will appear here. Everything is saved in the cloud.
        </p>
      </div>
    );
  }

  const handleDownload = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `curtis-history-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mt-12 pt-8 border-t border-border" data-testid="history-gallery">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif text-foreground">Studio Album</h2>
        <div className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>Saved to cloud</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden group flex flex-col bg-card border-card-border shadow-sm hover:shadow-md transition-shadow">
            <div className="relative aspect-square bg-muted">
              <img 
                src={item.output.imageDataUrl} 
                alt={item.input.prompt}
                className="w-full h-full object-cover"
                loading="lazy"
                data-testid={`history-img-${item.id}`}
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 rounded-full shadow-md"
                      onClick={() => onSelect(item)}
                      data-testid={`button-open-history-${item.id}`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in Studio</TooltipContent>
                </Tooltip>
                <InstagramPublishDialog 
                  imageDataUrl={item.output.imageDataUrl}
                  context={{
                    prompt: item.input.prompt,
                    aspectRatio: item.input.aspectRatio,
                  }}
                  trigger={
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="h-8 w-8 rounded-full shadow-md bg-pink-100 hover:bg-pink-200 text-pink-600 dark:bg-pink-900/30 dark:hover:bg-pink-900/50 dark:text-pink-500 border-0"
                          data-testid={`button-instagram-history-${item.id}`}
                        >
                          <Instagram className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Publish to Instagram</TooltipContent>
                    </Tooltip>
                  }
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      className="h-8 w-8 rounded-full shadow-md"
                      onClick={() => handleDownload(item.output.imageDataUrl)}
                      data-testid={`button-download-history-${item.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download Image</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="h-8 w-8 rounded-full shadow-md"
                      onClick={() => onDelete(item.id)}
                      data-testid={`button-delete-history-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete from history</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="p-3">
              <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug" title={item.input.prompt}>
                {item.input.prompt}
              </p>
              <div className="flex items-center justify-between mt-3 text-[10px] text-muted-foreground">
                <span className="font-mono">{item.input.aspectRatio}</span>
                <span>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
