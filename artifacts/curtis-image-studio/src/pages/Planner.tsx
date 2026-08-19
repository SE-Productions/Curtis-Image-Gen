import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetCreatorDna, 
  getGetCreatorDnaQueryKey,
  useUpdateCreatorDna,
  useGetContentPlan,
  getGetContentPlanQueryKey,
  useGenerateContentPlan,
  useGetStudioCapabilities,
  getGetStudioCapabilitiesQueryKey
} from "@workspace/api-client-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { StudioNavigation } from "@/components/studio-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Wand2, Calendar as CalendarIcon, ChevronDown, ChevronUp, Check, Play, Edit2, CheckCircle2, Clock, Trash } from "lucide-react";
import { getCurrentWeekStart } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { PlanItemCard } from "@/components/plan-item-card";

export default function Planner() {
  const queryClient = useQueryClient();
  const weekStart = getCurrentWeekStart();
  const [brief, setBrief] = useState("");
  
  const { data: capabilities } = useGetStudioCapabilities({
    query: { queryKey: getGetStudioCapabilitiesQueryKey() }
  });

  const { data: dna, isLoading: dnaLoading } = useGetCreatorDna({
    query: { queryKey: getGetCreatorDnaQueryKey() }
  });

  const { data: planResult, isLoading: planLoading } = useGetContentPlan(
    { weekStart }, 
    { query: { queryKey: getGetContentPlanQueryKey({ weekStart }) } }
  );

  const updateDnaMutation = useUpdateCreatorDna({
    mutation: {
      onSuccess: (data) => {
        toast.success("Creator DNA updated");
        queryClient.setQueryData(getGetCreatorDnaQueryKey(), data);
      },
      onError: (error: any) => {
        toast.error("Failed to update Creator DNA", { description: error.message });
      }
    }
  });

  const generatePlanMutation = useGenerateContentPlan({
    mutation: {
      onSuccess: (data) => {
        toast.success("Content plan generated");
        queryClient.setQueryData(getGetContentPlanQueryKey({ weekStart }), {
          plan: data,
        });
      },
      onError: (error: any) => {
        toast.error("Failed to generate plan", { description: error.message });
      }
    }
  });

  // Creator DNA state
  const [dnaForm, setDnaForm] = useState({
    voice: "",
    audience: "",
    visualStyle: "",
    themes: "",
    offers: "",
    goals: ""
  });
  const [dnaOpen, setDnaOpen] = useState(true);

  useEffect(() => {
    if (dna) {
      setDnaForm({
        voice: dna.voice,
        audience: dna.audience,
        visualStyle: dna.visualStyle,
        themes: dna.themes.join(", "),
        offers: dna.offers,
        goals: dna.goals
      });
    }
  }, [dna]);

  const handleSaveDna = () => {
    updateDnaMutation.mutate({
      data: {
        ...dnaForm,
        themes: dnaForm.themes.split(",").map(t => t.trim()).filter(Boolean)
      }
    });
  };

  const handleGeneratePlan = () => {
    if (!dna?.updatedAt) {
      setDnaOpen(true);
      toast.error("Save Creator DNA before generating a plan");
      return;
    }
    if (!brief) {
      toast.error("Please enter a brief for the week");
      return;
    }
    generatePlanMutation.mutate({
      data: {
        weekStart,
        brief
      }
    });
  };

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
              Content Planner
            </p>
          </div>
        </div>
        <StudioNavigation active="planner" />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12 flex-1 flex flex-col gap-8">
        {/* Creator DNA Section */}
        <Card className="border-border shadow-sm bg-card overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => setDnaOpen(!dnaOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-serif text-xl text-foreground">Creator DNA</h2>
                <p className="text-xs text-muted-foreground">Define your unique voice and style for AI generation</p>
              </div>
            </div>
            {dnaOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </div>
          
          {dnaOpen && (
            <CardContent className="pt-2 pb-6 border-t border-border bg-muted/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="voice">Voice & Tone</Label>
                  <Textarea 
                    id="voice" 
                    value={dnaForm.voice} 
                    onChange={e => setDnaForm(prev => ({...prev, voice: e.target.value}))}
                    placeholder="e.g. Educational, encouraging, direct..."
                    className="h-20 resize-none bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <Textarea 
                    id="audience" 
                    value={dnaForm.audience} 
                    onChange={e => setDnaForm(prev => ({...prev, audience: e.target.value}))}
                    placeholder="Who are you talking to?"
                    className="h-20 resize-none bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visualStyle">Visual Style</Label>
                  <Textarea 
                    id="visualStyle" 
                    value={dnaForm.visualStyle} 
                    onChange={e => setDnaForm(prev => ({...prev, visualStyle: e.target.value}))}
                    placeholder="Describe your aesthetic for image generation"
                    className="h-20 resize-none bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="themes">Core Themes (comma separated)</Label>
                  <Textarea 
                    id="themes" 
                    value={dnaForm.themes} 
                    onChange={e => setDnaForm(prev => ({...prev, themes: e.target.value}))}
                    placeholder="Design, Tech, Productivity..."
                    className="h-20 resize-none bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offers">Products / Offers</Label>
                  <Textarea 
                    id="offers" 
                    value={dnaForm.offers} 
                    onChange={e => setDnaForm(prev => ({...prev, offers: e.target.value}))}
                    placeholder="What are you selling or promoting?"
                    className="h-20 resize-none bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goals">Current Goals</Label>
                  <Textarea 
                    id="goals" 
                    value={dnaForm.goals} 
                    onChange={e => setDnaForm(prev => ({...prev, goals: e.target.value}))}
                    placeholder="e.g. Grow newsletter, sell course..."
                    className="h-20 resize-none bg-background"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveDna} disabled={updateDnaMutation.isPending}>
                  {updateDnaMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Creator DNA
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Content Plan Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl tracking-tight text-foreground">Weekly Plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Week of {format(parseISO(weekStart), "MMMM d, yyyy")}
              </p>
            </div>
            {!planResult?.plan && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Input 
                  placeholder="Week brief / focus (e.g. Launching new course)" 
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  className="sm:w-64 bg-background"
                />
                <Button 
                  onClick={handleGeneratePlan} 
                  disabled={generatePlanMutation.isPending}
                  className="whitespace-nowrap"
                >
                  {generatePlanMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate Plan
                </Button>
              </div>
            )}
          </div>

          {planLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground border border-border border-dashed rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
              <p>Loading plan...</p>
            </div>
          ) : planResult?.plan ? (
            <div className="grid gap-6">
              {planResult.plan.items.map(item => (
                <PlanItemCard 
                  key={item.id} 
                  item={item} 
                  weekStart={weekStart} 
                  grokConfigured={capabilities?.grokConfigured} 
                />
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground border border-border border-dashed rounded-xl bg-card text-center px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No plan for this week</h3>
              <p className="text-sm mt-1 max-w-md">Enter a brief and generate a new 7-day content plan powered by your Creator DNA.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
