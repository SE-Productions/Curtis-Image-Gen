import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Cpu, Instagram, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { disconnectInstagram, getStudioState, saveSettings } from "@/lib/functions";
import type { StudioCapabilities, StudioSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isPending } = useCurrentUserState();
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [caps, setCaps] = useState<StudioCapabilities | null>(null);
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [composio, setComposio] = useState<{
    ok: boolean;
    keyPresent: boolean;
    connected: boolean;
    accountCount: number;
    accounts: Array<{ id: string; status: string; username: string | null; disabled: boolean }>;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    void getStudioState().then((s) => {
      setSettings(s.settings);
      setCaps(s.capabilities);
      setUserId(s.settings.instagramUserId);
    });
    void fetch("/api/composio/status")
      .then((r) => r.json())
      .then(setComposio)
      .catch(() =>
        setComposio({
          ok: false,
          keyPresent: false,
          connected: false,
          accountCount: 0,
          accounts: [],
          error: "Could not reach Composio",
        }),
      );
  }, [isPending, user]);

  if (!user && !isPending) {
    return (
      <AppShell eyebrow="Settings">
        <h2 className="font-serif text-3xl tracking-tight">Studio</h2>
        <p className="mt-2 text-sm text-muted">
          Sign in to connect Instagram and set the daily drop time.
        </p>
      </AppShell>
    );
  }

  if (!settings) {
    return (
      <AppShell eyebrow="Settings">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  const current = settings;

  async function persist(
    patch: Partial<StudioSettings> & { instagramToken?: string; nvidiaApiKey?: string },
  ) {
    setSaving(true);
    try {
      const next = await saveSettings({
        data: {
          instagramUserId: patch.instagramUserId ?? userId,
          instagramToken: patch.instagramToken,
          nvidiaApiKey: patch.nvidiaApiKey,
          autoPublish: patch.autoPublish ?? current.autoPublish,
          postHour: patch.postHour ?? current.postHour,
          postMinute: patch.postMinute ?? current.postMinute,
          timezone: patch.timezone ?? current.timezone,
        },
      });
      setSettings(next);
      setToken("");
      setNvidiaKey("");
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell eyebrow="Settings" nvidia={caps?.nvidia}>
      <h2 className="mb-6 font-serif text-3xl tracking-tight">Studio</h2>
      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Instagram className="size-4 text-primary" />
              <h3 className="font-serif text-xl">Composio Instagram</h3>
              {composio?.connected ? (
                <Badge tone="ok">
                  <CheckCircle2 className="size-3" />
                  Connected
                </Badge>
              ) : composio?.ok ? (
                <Badge>No IG account</Badge>
              ) : (
                <Badge>{composio?.keyPresent ? "Key error" : "Not configured"}</Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              Daily drops use the Instagram account connected in Composio. This page only
              checks the connection — it does not publish.
            </p>
            {composio?.error ? (
              <p className="text-sm text-primary">{composio.error}</p>
            ) : null}
            {composio?.accounts?.length ? (
              <ul className="space-y-2 text-sm">
                {composio.accounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <span>
                      {account.username ? `@${account.username.replace(/^@/, "")}` : account.id.slice(0, 12)}
                    </span>
                    <Badge tone={account.status === "ACTIVE" && !account.disabled ? "ok" : "muted"}>
                      {account.disabled ? "Disabled" : account.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {composio ? "No Instagram account is linked to this Composio key yet." : "Checking Composio…"}
              </p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Instagram className="size-4 text-primary" />
              <h3 className="font-serif text-xl">Instagram</h3>
              {settings.hasToken ? (
                <Badge tone="ok">
                  <CheckCircle2 className="size-3" />
                  {settings.instagramUsername || "Connected"}
                </Badge>
              ) : (
                <Badge>Not connected</Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              Connect your Instagram Business or Creator account to publish automatically,
              once per day. Paste the Graph API user id and a long-lived access token.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="igid">Instagram user id</Label>
              <Input
                id="igid"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="1789…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="token">Access token</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={settings.hasToken ? "Token saved · paste to replace" : "EAAG…"}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={saving}
                onClick={() =>
                  void persist({
                    instagramUserId: userId,
                    instagramToken: token || undefined,
                  })
                }
              >
                Connect Instagram
              </Button>
              {settings.hasToken ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    setSettings(await disconnectInstagram());
                    setUserId("");
                  }}
                >
                  <Unplug />
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl">Daily drop</h3>
              <Switch
                checked={settings.autoPublish}
                onCheckedChange={(autoPublish) => void persist({ autoPublish })}
              />
            </div>
            <p className="text-sm text-muted">
              Post exactly once per day at the time below. Later items wait their turn.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hour">Hour</Label>
                <Input
                  id="hour"
                  type="number"
                  min={0}
                  max={23}
                  value={settings.postHour}
                  onChange={(e) =>
                    setSettings({ ...settings, postHour: Number(e.target.value) })
                  }
                  onBlur={() => void persist({ postHour: settings.postHour })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minute">Minute</Label>
                <Input
                  id="minute"
                  type="number"
                  min={0}
                  max={59}
                  value={settings.postMinute}
                  onChange={(e) =>
                    setSettings({ ...settings, postMinute: Number(e.target.value) })
                  }
                  onBlur={() => void persist({ postMinute: settings.postMinute })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                value={settings.timezone}
                onChange={(e) =>
                  setSettings({ ...settings, timezone: e.target.value })
                }
                onBlur={() => void persist({ timezone: settings.timezone })}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="size-4 text-nvidia" />
              <h3 className="font-serif text-xl">NVIDIA director</h3>
              {caps?.nvidia ? (
                <Badge tone="nvidia">
                  <Cpu className="size-3" /> NVIDIA
                </Badge>
              ) : (
                <Badge>Key not set</Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              NVIDIA Llama writes ultra-realistic scene prompts with true face fidelity.
              Paste a NIM API key, or Grok directs when NVIDIA is unavailable.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="nvkey">NVIDIA API key</Label>
              <Input
                id="nvkey"
                type="password"
                value={nvidiaKey}
                onChange={(e) => setNvidiaKey(e.target.value)}
                placeholder={
                  settings.hasNvidiaKey || caps?.nvidia
                    ? "Key saved · paste to replace"
                    : "nvapi-…"
                }
              />
            </div>
            <Button
              variant="outline"
              disabled={saving || !nvidiaKey.trim()}
              onClick={() => void persist({ nvidiaApiKey: nvidiaKey })}
            >
              Save NVIDIA key
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center justify-between">
            <p className="text-sm text-muted">Account</p>
            <UserButton />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
