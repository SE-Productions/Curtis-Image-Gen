import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ContentItem,
  useUpdateContentItem,
  useDeleteContentItem,
  useAddContentVariation,
  useApproveContentItem,
  useScheduleContentItem,
  useGenerateStudioImage,
  useCreateStudioScene,
  getGetContentPlanQueryKey
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Edit2,
  Check,
  X,
  ImageIcon,
  Wand2,
  Loader2,
  CalendarClock,
  Trash,
} from "lucide-react";
import { toast } from "sonner";

interface PlanItemCardProps {
  item: ContentItem;
  weekStart: string;
  grokConfigured?: boolean;
}

export function PlanItemCard({ item, weekStart, grokConfigured }: PlanItemCardProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: item.title,
    concept: item.concept,
    prompt: item.prompt,
    caption: item.caption,
    format: item.format,
    provider: item.provider
  });
  const [scheduledTime, setScheduledTime] = useState("");

  const updateMutation = useUpdateContentItem({
    mutation: {
      onSuccess: () => {
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
        toast.success("Item updated");
      },
      onError: (err: any) => toast.error("Failed to update item", { description: err.message })
    }
  });

  const deleteMutation = useDeleteContentItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
        toast.success("Content item deleted");
      },
      onError: (err: any) => toast.error("Failed to delete item", { description: err.message })
    }
  });

  const generateImageMutation = useGenerateStudioImage();
  const createSceneMutation = useCreateStudioScene();
  const addVariationMutation = useAddContentVariation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
        toast.success("Scene generated and saved");
      },
      onError: (err: any) => toast.error("Failed to add variation", { description: err.message })
    }
  });

  const approveMutation = useApproveContentItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
        toast.success("Variation approved");
      },
      onError: (err: any) => toast.error("Failed to approve variation", { description: err.message })
    }
  });

  const scheduleMutation = useScheduleContentItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
        toast.success("Item scheduled");
        setScheduledTime("");
      },
      onError: (err: any) => toast.error("Failed to schedule item", { description: err.message })
    }
  });

  const handleSaveEdit = () => {
    updateMutation.mutate({
      contentItemId: item.id,
      data: editForm
    });
  };

  const handleGenerate = () => {
    generateImageMutation.mutate({
      data: {
        prompt: item.prompt,
        aspectRatio: item.format === "feed" ? "1:1" : "9:16",
        provider: item.provider,
        fidelity: "balanced"
      }
    }, {
      onSuccess: (image) => {
        createSceneMutation.mutate({
          data: {
            prompt: item.prompt,
            aspectRatio: item.format === "feed" ? "1:1" : "9:16",
            fidelity: "balanced",
            referenceUsed: false,
            imageDataUrl: image.imageDataUrl,
            provider: image.provider
          }
        }, {
          onSuccess: (scene) => {
            addVariationMutation.mutate({
              contentItemId: item.id,
              data: { sceneId: scene.id }
            });
          },
          onError: (err: any) => toast.error("Failed to save scene", { description: err.message })
        });
      },
      onError: (err: any) => toast.error("Failed to generate image", { description: err.message })
    });
  };

  const isGenerating = generateImageMutation.isPending || createSceneMutation.isPending || addVariationMutation.isPending;

  const statusColors: Record<string, string> = {
    idea: "bg-muted text-muted-foreground",
    generated: "bg-blue-100 text-blue-800 border-blue-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    scheduled: "bg-purple-100 text-purple-800 border-purple-200",
    published: "bg-primary/20 text-primary border-primary/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30"
  };

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="bg-muted/30 border-b border-border p-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center bg-background rounded-md w-12 h-12 border border-border">
            <span className="text-xs text-muted-foreground font-mono uppercase">{format(parseISO(item.planDate), "MMM")}</span>
            <span className="text-lg font-serif leading-none">{format(parseISO(item.planDate), "d")}</span>
          </div>
          <div>
            <h3 className="font-medium text-foreground">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={statusColors[item.status] || "bg-muted"}>
                {item.status.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                {item.format}
              </Badge>
            </div>
          </div>
        </div>
        {!isEditing && item.status !== "published" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Edit ${item.title}`}
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${item.title}`}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Delete "${item.title}" from this plan?`)) {
                  deleteMutation.mutate({ contentItemId: item.id });
                }
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Col: Edit or View */}
        <div className="space-y-4">
          {isEditing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={editForm.format} onValueChange={(val: any) => setEditForm({...editForm, format: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="reel">Reel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Provider</Label>
                  <Select 
                    value={editForm.provider} 
                    onValueChange={(val: any) => setEditForm({...editForm, provider: val})}
                    disabled={!grokConfigured && editForm.provider !== "openai"}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      {grokConfigured && <SelectItem value="grok">Grok</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Concept</Label>
                <Textarea className="resize-none h-16" value={editForm.concept} onChange={e => setEditForm({...editForm, concept: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Image Prompt</Label>
                <Textarea className="resize-none h-20" value={editForm.prompt} onChange={e => setEditForm({...editForm, prompt: e.target.value})} />
              </div>
              <div className="space-y-1">
                <Label>Caption</Label>
                <Textarea className="resize-none h-20" value={editForm.caption} onChange={e => setEditForm({...editForm, caption: e.target.value})} />
              </div>
              <div className="flex items-center gap-2 justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    title: item.title,
                    concept: item.concept,
                    prompt: item.prompt,
                    caption: item.caption,
                    format: item.format,
                    provider: item.provider
                  });
                }}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Concept</Label>
                <p className="text-sm mt-1">{item.concept}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt</Label>
                <div className="bg-muted/50 p-2 rounded-md text-sm font-mono mt-1 whitespace-pre-wrap">
                  {item.prompt}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Caption</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{item.caption}</p>
              </div>
              <div className="pt-2">
                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || item.status === "published" || item.status === "scheduled"}
                  variant="outline"
                  className="w-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  Generate Scene Variation ({item.provider})
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Col: Variations & Scheduling */}
        <div className="border-l border-border pl-6 flex flex-col gap-4">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Generated Scenes</Label>
          
          {item.variations.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {item.variations.map(variation => {
                const isSelected = item.selectedSceneId === variation.sceneId;
                return (
                  <div key={variation.id} className={`relative rounded-md overflow-hidden border-2 transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border'}`}>
                    <div className="aspect-square bg-muted">
                      <img src={variation.imageDataUrl} alt="Variation" className="w-full h-full object-cover" />
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                    {!isSelected && item.status !== "scheduled" && item.status !== "published" && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => approveMutation.mutate({ contentItemId: item.id, data: { sceneId: variation.sceneId } })}
                          disabled={approveMutation.isPending}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 border border-dashed border-border rounded-lg text-muted-foreground py-8">
              <ImageIcon className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-xs text-center px-4">No scenes generated yet.<br/>Generate one to approve.</p>
            </div>
          )}

          {["approved", "failed"].includes(item.status) && (
            <div className="mt-auto bg-muted/30 p-3 rounded-lg border border-border">
              <Label className="text-xs mb-2 block">
                {item.status === "failed" ? "Retry scheduling (UTC)" : "Schedule publication (UTC)"}
              </Label>
              <div className="flex gap-2">
                <Input 
                  type="time"
                  value={scheduledTime} 
                  onChange={e => setScheduledTime(e.target.value)} 
                  className="h-8 text-xs bg-background"
                />
                <Button 
                  size="sm" 
                  className="h-8"
                  disabled={!scheduledTime || scheduleMutation.isPending}
                  onClick={() => scheduleMutation.mutate({
                    contentItemId: item.id,
                    data: {
                      scheduledFor: `${item.planDate}T${scheduledTime}:00Z`,
                    },
                  })}
                >
                  <CalendarClock className="w-4 h-4 mr-1" /> Schedule
                </Button>
              </div>
            </div>
          )}
          
          {item.status === "scheduled" && (
            <div className="mt-auto bg-purple-50 p-3 rounded-lg border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-200 flex items-center">
                <CalendarClock className="w-4 h-4 mr-1.5" /> 
                Scheduled for {format(parseISO(item.scheduledFor!), "MMM d, HH:mm")} UTC
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
