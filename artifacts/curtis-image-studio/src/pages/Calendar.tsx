import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetContentPlan, 
  getGetContentPlanQueryKey,
  useScheduleContentItem,
  useUnscheduleContentItem,
  ContentItem
} from "@workspace/api-client-react";
import { format, parseISO, isSameDay } from "date-fns";
import { CalendarClock, CheckCircle, Clock, Calendar as CalendarIcon, Loader2, Play, Instagram } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { StudioNavigation } from "@/components/studio-navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getCurrentWeekStart } from "@/lib/date-utils";
import { InstagramPublishDialog } from "@/components/instagram-publish-dialog";

export default function Calendar() {
  const queryClient = useQueryClient();
  const weekStart = getCurrentWeekStart();
  const [schedulingItem, setSchedulingItem] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState("");

  const { data: planResult, isLoading } = useGetContentPlan(
    { weekStart },
    { query: { queryKey: getGetContentPlanQueryKey({ weekStart }) } }
  );

  const scheduleMutation = useScheduleContentItem({
    mutation: {
      onSuccess: () => {
        toast.success("Item scheduled");
        setSchedulingItem(null);
        setScheduledTime("");
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
      }
    }
  });

  const unscheduleMutation = useUnscheduleContentItem({
    mutation: {
      onSuccess: () => {
        toast.success("Item unscheduled");
        queryClient.invalidateQueries({ queryKey: getGetContentPlanQueryKey({ weekStart }) });
      }
    }
  });

  const items = planResult?.plan?.items || [];
  
  // Group items by date
  const groupedItems = items.reduce((acc, item) => {
    const dateStr = item.planDate;
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(item);
    return acc;
  }, {} as Record<string, ContentItem[]>);
  
  const dates = Object.keys(groupedItems).sort();

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
              Content Calendar
            </p>
          </div>
        </div>
        <StudioNavigation active="calendar" />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12 flex-1">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl tracking-tight text-foreground">Weekly Calendar</h2>
            <p className="text-sm text-muted-foreground mt-1">Review, schedule, and publish this week's content.</p>
          </div>
          <div className="bg-muted px-4 py-2 rounded-lg border border-border">
            <p className="text-xs font-medium text-foreground">Week of {format(parseISO(weekStart), "MMM d")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading calendar...</p>
          </div>
        ) : dates.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center border border-border border-dashed rounded-xl bg-card">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CalendarIcon className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-serif text-foreground">No Content Planned</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Head over to the Planner to generate your content plan for this week.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {dates.map(dateStr => (
              <div key={dateStr} className="flex flex-col md:flex-row gap-6">
                <div className="md:w-32 flex-shrink-0 pt-2">
                  <div className="sticky top-24">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                      {format(parseISO(dateStr), "EEEE")}
                    </p>
                    <p className="text-3xl font-serif text-foreground leading-none mt-1">
                      {format(parseISO(dateStr), "d")}
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  {groupedItems[dateStr].map(item => {
                    const scene = item.selectedSceneId 
                      ? item.variations.find(v => v.sceneId === item.selectedSceneId)
                      : null;

                    return (
                      <Card key={item.id} className="overflow-hidden border-border bg-card">
                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-48 aspect-square bg-muted flex-shrink-0 border-r border-border flex items-center justify-center relative">
                            {scene ? (
                              <img src={scene.imageDataUrl} className="w-full h-full object-cover" alt="Scene" />
                            ) : (
                              <div className="text-center p-4">
                                <p className="text-xs text-muted-foreground font-mono">No Scene</p>
                              </div>
                            )}
                            <div className="absolute top-2 left-2">
                              <Badge variant="secondary" className="text-[10px] uppercase font-mono shadow-sm bg-background/90 backdrop-blur">
                                {item.format}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="flex-1 p-5 flex flex-col">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <h3 className="font-medium text-lg leading-tight text-foreground">{item.title}</h3>
                              <Badge variant="outline" className={
                                item.status === "published" ? "bg-primary/20 text-primary border-primary/30" :
                                item.status === "scheduled" ? "bg-purple-100 text-purple-800 border-purple-200" :
                                item.status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                "bg-muted text-muted-foreground"
                              }>
                                {item.status.toUpperCase()}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{item.concept}</p>
                            
                            <div className="mt-auto pt-4 border-t border-border flex items-center justify-between gap-4">
                              <div className="text-sm">
                                {item.status === "scheduled" && item.scheduledFor && (
                                  <div className="flex items-center text-purple-700 dark:text-purple-300 font-medium">
                                    <Clock className="w-4 h-4 mr-1.5" />
                                    {format(parseISO(item.scheduledFor), "h:mm a")}
                                  </div>
                                )}
                                {item.status === "published" && item.publishedAt && (
                                  <div className="flex items-center text-primary font-medium">
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    Published {format(parseISO(item.publishedAt), "MMM d")}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {item.status === "approved" && (
                                  <>
                                    {schedulingItem === item.id ? (
                                      <div className="flex items-center gap-2">
                                        <Input 
                                          type="time" 
                                          value={scheduledTime}
                                          onChange={e => setScheduledTime(e.target.value)}
                                          className="h-8 w-32 text-xs bg-background"
                                        />
                                        <Button 
                                          size="sm" 
                                          className="h-8"
                                          disabled={!scheduledTime || scheduleMutation.isPending}
                                          onClick={() => {
                                            // combine planDate and time
                                            const dateTimeStr = `${item.planDate}T${scheduledTime}:00`;
                                            scheduleMutation.mutate({
                                              contentItemId: item.id,
                                              data: { scheduledFor: new Date(dateTimeStr).toISOString() }
                                            });
                                          }}
                                        >
                                          Confirm
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-8" onClick={() => setSchedulingItem(null)}>
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button size="sm" variant="outline" onClick={() => setSchedulingItem(item.id)}>
                                        <CalendarClock className="w-4 h-4 mr-2" /> Schedule
                                      </Button>
                                    )}
                                  </>
                                )}
                                
                                {item.status === "scheduled" && (
                                  <>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={() => unscheduleMutation.mutate({ contentItemId: item.id })}
                                      disabled={unscheduleMutation.isPending}
                                    >
                                      Unschedule
                                    </Button>
                                    
                                    {scene && (
                                      <InstagramPublishDialog 
                                        imageDataUrl={scene.imageDataUrl}
                                        contentItemId={item.id}
                                        context={{
                                          prompt: item.prompt,
                                          aspectRatio: item.format === "feed" ? "1:1" : "9:16",
                                          initialCaption: item.caption
                                        }}
                                        trigger={
                                          <Button size="sm" className="bg-pink-600 hover:bg-pink-700 text-white border-0">
                                            <Instagram className="w-4 h-4 mr-2" /> Publish Now
                                          </Button>
                                        }
                                        onPublished={() => {
                                          queryClient.invalidateQueries({
                                            queryKey: getGetContentPlanQueryKey({ weekStart })
                                          });
                                        }}
                                        onPublishFailed={() => {
                                          queryClient.invalidateQueries({
                                            queryKey: getGetContentPlanQueryKey({ weekStart })
                                          });
                                        }}
                                      />
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}