import { type FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetInstagramPublishingStatusQueryKey,
  getGetStudioCapabilitiesQueryKey,
  getGetStudioSessionQueryKey,
  type InstagramPublishingStatus,
  useBeginInstagramConnection,
  useCreateStudioSession,
  useDisconnectInstagramAccount,
  useGetInstagramPublishingStatus,
  useGetStudioCapabilities,
  useGetStudioSession,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Instagram,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { StudioNavigation } from "@/components/studio-navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const instagramAuthorizationPollMs = 3_000;
const instagramAuthorizationTimeoutMs = 2 * 60 * 1_000;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [authorizationStartedAt, setAuthorizationStartedAt] = useState<
    number | null
  >(() =>
    new URLSearchParams(window.location.search).get("instagram") === "connected"
      ? Date.now()
      : null,
  );
  const [accessPassword, setAccessPassword] = useState("");

  const { data: studioSession, isLoading: sessionLoading } =
    useGetStudioSession({
      query: {
        retry: false,
        queryKey: getGetStudioSessionQueryKey(),
      },
    });
  const studioLocked =
    studioSession?.required === true && studioSession.unlocked !== true;
  const canLoadSettings =
    studioSession?.unlocked === true || studioSession?.required === false;

  const statusQuery = useGetInstagramPublishingStatus({
    query: {
      enabled: canLoadSettings,
      retry: false,
      queryKey: getGetInstagramPublishingStatusQueryKey(),
    },
  });
  const status = statusQuery.data;
  const { data: capabilities } = useGetStudioCapabilities({
    query: { queryKey: getGetStudioCapabilitiesQueryKey() },
  });

  const unlockMutation = useCreateStudioSession({
    mutation: {
      onSuccess: () => {
        setAccessPassword("");
        queryClient.invalidateQueries({
          queryKey: getGetStudioSessionQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getGetInstagramPublishingStatusQueryKey(),
        });
        toast.success("Studio unlocked");
      },
      onError: () => {
        toast.error("That access password is not correct.");
      },
    },
  });

  const connectMutation = useBeginInstagramConnection();
  const disconnectMutation = useDisconnectInstagramAccount();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("instagram") !== "connected") return;
    url.searchParams.delete("instagram");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  useEffect(() => {
    if (authorizationStartedAt == null) return;
    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: getGetInstagramPublishingStatusQueryKey(),
      });
    };
    refresh();
    const interval = window.setInterval(() => {
      refresh();
    }, instagramAuthorizationPollMs);
    const elapsed = Date.now() - authorizationStartedAt;
    const timeout = window.setTimeout(
      () => {
        setAuthorizationStartedAt(null);
        toast.message("Instagram authorization is still incomplete.", {
          description:
            "Finish the authorization tab, then use Refresh to check again.",
        });
      },
      Math.max(0, instagramAuthorizationTimeoutMs - elapsed),
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [authorizationStartedAt, queryClient]);

  useEffect(() => {
    if (authorizationStartedAt != null && status?.connected) {
      setAuthorizationStartedAt(null);
      toast.success("Instagram connected");
    }
  }, [authorizationStartedAt, status?.connected]);

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessPassword) return;
    unlockMutation.mutate({ data: { password: accessPassword } });
  };

  const handleConnect = () => {
    const authorizationWindow = window.open("about:blank", "_blank");
    if (!authorizationWindow) {
      toast.error("Allow pop-ups to connect Instagram.");
      return;
    }
    authorizationWindow.opener = null;

    connectMutation.mutate(undefined, {
      onSuccess: (connection) => {
        authorizationWindow.location.replace(connection.authorizationUrl);
        setAuthorizationStartedAt(Date.now());
        toast.message("Complete Instagram authorization in the new tab.");
      },
      onError: (error: any) => {
        authorizationWindow.close();
        toast.error("Could not start Instagram connection", {
          description:
            error?.data?.error ??
            "Check the protected Composio configuration and try again.",
        });
      },
    });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        setAuthorizationStartedAt(null);
        queryClient.setQueryData<InstagramPublishingStatus>(
          getGetInstagramPublishingStatusQueryKey(),
          (current) =>
            current
              ? {
                  ...current,
                  available: false,
                  connected: false,
                  connectionStatus: "disconnected",
                  accountLabel: null,
                  updatedAt: null,
                }
              : current,
        );
        queryClient.invalidateQueries({
          queryKey: getGetInstagramPublishingStatusQueryKey(),
        });
        toast.success("Instagram disconnected");
      },
      onError: (error: any) => {
        toast.error("Could not disconnect Instagram", {
          description:
            error?.data?.error ?? "Please try again in a moment.",
        });
      },
    });
  };

  const refreshStatus = () => {
    statusQuery.refetch();
  };

  const statusBadge = (() => {
    switch (status?.connectionStatus) {
      case "connected":
        return (
          <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Connected
          </Badge>
        );
      case "connecting":
        return (
          <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Connecting
          </Badge>
        );
      case "attention":
        return <Badge variant="destructive">Needs attention</Badge>;
      case "not_configured":
        return <Badge variant="destructive">Server setup required</Badge>;
      default:
        return <Badge variant="secondary">Not connected</Badge>;
    }
  })();

  return (
    <div
      className="min-h-[100dvh] bg-background selection:bg-primary/20"
      data-testid="page-settings"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-10 w-10 shrink-0 drop-shadow-sm" />
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg leading-none tracking-wide text-foreground sm:text-xl">
              Curtis Image Studio
            </h1>
            <p className="mt-1 hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">
              Account & publishing setup
            </p>
          </div>
        </div>
        <StudioNavigation active="settings" />
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.22em] text-primary">
            Settings
          </p>
          <h2 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
            Connected accounts
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Connect the Instagram account Curtis can publish to. Generation
            never posts automatically—you will always review the caption and
            confirm publishing.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border bg-muted/25">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600 via-pink-600 to-amber-500 text-white shadow-sm">
                    <Instagram className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>Instagram</CardTitle>
                    <CardDescription>
                      Feed publishing through Composio
                    </CardDescription>
                  </div>
                </div>
                {statusQuery.isLoading || sessionLoading ? (
                  <Badge variant="secondary">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Checking
                  </Badge>
                ) : (
                  statusBadge
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-6 p-5 sm:p-6">
              {statusQuery.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Connection status unavailable</AlertTitle>
                  <AlertDescription>
                    Curtis could not reach Composio. Refresh the status before
                    attempting to publish.
                  </AlertDescription>
                </Alert>
              )}

              {status?.connectionStatus === "not_configured" && (
                <Alert variant="destructive">
                  <KeyRound className="h-4 w-4" />
                  <AlertTitle>Protected server setup required</AlertTitle>
                  <AlertDescription>
                    Add the Composio API key to the server&apos;s protected
                    environment configuration. For security, Curtis never
                    accepts or displays this key in the browser.
                  </AlertDescription>
                </Alert>
              )}

              {authorizationStartedAt != null && !status?.connected && (
                <Alert>
                  <ExternalLink className="h-4 w-4" />
                  <AlertTitle>Authorization in progress</AlertTitle>
                  <AlertDescription>
                    Complete Instagram authorization in the new tab. This page
                    is checking the real Composio connection automatically.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Composio server
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-medium">
                    {status?.configured ? (
                      <>
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        Securely configured
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Not configured
                      </>
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Instagram account
                  </p>
                  <p className="mt-2 truncate font-medium">
                    {status?.connected
                      ? status.accountLabel || "Connected creator account"
                      : status?.connectionStatus === "connecting"
                        ? "Authorization pending"
                        : "No active account"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {status?.connected
                      ? "Publishing connection is ready"
                      : "Connect a professional Instagram account"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Instagram requires a Business or Creator account.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refreshStatus}
                    disabled={statusQuery.isFetching || !canLoadSettings}
                    data-testid="button-instagram-settings-refresh"
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${
                        statusQuery.isFetching ? "animate-spin" : ""
                      }`}
                    />
                    Refresh
                  </Button>

                  {status?.connected ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={disconnectMutation.isPending}
                          data-testid="button-instagram-settings-disconnect"
                        >
                          <Unplug className="mr-2 h-4 w-4" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Disconnect Instagram?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Curtis will no longer be able to publish to this
                            account. Existing Instagram posts are not deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep connected</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDisconnect}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid="button-instagram-settings-confirm-disconnect"
                          >
                            Disconnect account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={
                        !status?.configured || connectMutation.isPending
                      }
                      data-testid="button-instagram-settings-connect"
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Instagram className="mr-2 h-4 w-4" />
                      )}
                      {status?.connectionStatus === "attention"
                        ? "Reconnect Instagram"
                        : "Connect Instagram"}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Image providers</CardTitle>
                <CardDescription>
                  Provider keys stay in protected server configuration.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Bot className="h-4 w-4" />
                    OpenAI
                  </span>
                  {capabilities?.openaiConfigured ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Bot className="h-4 w-4" />
                    Grok Imagine
                  </span>
                  {capabilities?.grokConfigured ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                      Ready
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not configured</Badge>
                  )}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  OpenAI supports identity-preserving reference images. Grok
                  Imagine is text-to-image only and cannot use a reference
                  image. Both provider secrets stay on the server.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publishing safety</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>Provider credentials stay on the server.</p>
                </div>
                <div className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>Every post requires an explicit final confirmation.</p>
                </div>
                <div className="flex gap-3">
                  <Instagram className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <p>
                    Personal Instagram accounts are not supported by the
                    publishing API.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Connection details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">Composio</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Account type</span>
                  <span className="text-right font-medium">
                    Business or Creator
                  </span>
                </div>
                {status?.updatedAt && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        Last provider update
                      </span>
                      <span className="text-right text-xs font-medium">
                        {new Date(status.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
            <DialogTitle>Unlock Settings</DialogTitle>
            <DialogDescription>
              Enter the operator access password to manage connected accounts.
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
              {unlockMutation.isPending ? "Unlocking…" : "Unlock Settings"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}