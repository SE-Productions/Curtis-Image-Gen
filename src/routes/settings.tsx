import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Instagram, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getStudioState, saveSettings } from "@/lib/functions";
import type { StudioCapabilities, StudioSettings } from "@/lib/types";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type ComposioAccount = {
  id: string;
  status: string;
  username: string | null;
  name: string | null;
  accountType: string | null;
  disabled: boolean;
};

type ComposioStatus = {
  ok: boolean;
  keyPresent: boolean;
  connected: boolean;
  accountCount: number;
  accounts: ComposioAccount[];
  error: string | null;
};

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={
        on
          ? "inline-block size-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
          : "inline-block size-2.5 shrink-0 rounded-full bg-zinc-300"
      }
    />
  );
}

function KeyRow({
  id,
  label,
  hint,
  saved,
  placeholder,
  value,
  onChange,
  onSave,
  onDelete,
  saving,
}: {
  id: string;
  label: string;
  hint: string;
  saved: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="inline-flex items-center gap-2">
          <StatusDot on={saved} />
          {label}
        </Label>
        <Badge tone={saved ? "ok" : "muted"}>{saved ? "Active" : "Empty"}</Badge>
      </div>
      <p className="text-sm text-muted">{hint}</p>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={saved ? "Key saved · paste to replace" : placeholder}
      />
      <div className="flex gap-2">
        <Button className="flex-1" disabled={saving || !value.trim()} onClick={onSave}>
          Save key
        </Button>
        <Button variant="outline" disabled={saving || !saved} onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [caps, setCaps] = useState<StudioCapabilities | null>(null);
  const [nvidiaKey, setNvidiaKey] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [composioKey, setComposioKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [composio, setComposio] = useState<ComposioStatus | null>(null);

  async function refreshComposio() {
    const res = await fetch("/api/composio/status");
    const body = (await res.json()) as ComposioStatus;
    setComposio(body);
    return body;
  }

  useEffect(() => {
    void getStudioState().then((s) => {
      setSettings(s.settings);
      setCaps(s.capabilities);
    });
    void refreshComposio().catch(() =>
      setComposio({
        ok: false,
        keyPresent: false,
        connected: false,
        accountCount: 0,
        accounts: [],
        error: "Could not reach Composio",
      }),
    );
  }, []);

  if (!settings) {
    return (
      <AppShell eyebrow="Settings">
        <p className="text-sm text-muted">Loading…</p>
      </AppShell>
    );
  }

  const current = settings;

  async function persist(
    patch: Partial<StudioSettings> & {
      nvidiaApiKey?: string;
      xaiApiKey?: string;
      composioApiKey?: string;
      composioAccountId?: string;
      clearNvidia?: boolean;
      clearXai?: boolean;
      clearComposio?: boolean;
    },
  ) {
    setSaving(true);
    try {
      const next = await saveSettings({
        data: {
          nvidiaApiKey: patch.nvidiaApiKey,
          xaiApiKey: patch.xaiApiKey,
          composioApiKey: patch.composioApiKey,
          composioAccountId: patch.composioAccountId ?? current.composioAccountId,
          clearNvidia: patch.clearNvidia,
          clearXai: patch.clearXai,
          clearComposio: patch.clearComposio,
          autoPublish: patch.autoPublish ?? current.autoPublish,
          postHour: patch.postHour ?? current.postHour,
          postMinute: patch.postMinute ?? current.postMinute,
          timezone: patch.timezone ?? current.timezone,
        },
      });
      setSettings(next);
      setNvidiaKey("");
      setXaiKey("");
      setComposioKey("");
      toast.success("Settings saved");
      const state = await getStudioState();
      setCaps(state.capabilities);
      if (patch.composioApiKey || patch.clearComposio) {
        await refreshComposio();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  const selectedAccount =
    composio?.accounts.find((account) => account.id === settings.composioAccountId) ??
    composio?.accounts.find((account) => account.status === "ACTIVE" && !account.disabled) ??
    null;

  return (
    <AppShell eyebrow="Settings" nvidia={caps?.nvidia}>
      <h2 className="mb-6 font-serif text-3xl tracking-tight">Studio</h2>
      <div className="space-y-4">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <h3 className="font-serif text-xl">AI keys</h3>
            </div>
            <p className="text-sm text-muted">
              Add or replace the keys this studio uses. Env keys still work as fallback until you
              save one here.
            </p>
            <KeyRow
              id="nvkey"
              label="NVIDIA NIM"
              hint="Writes the ultra-realistic scene prompts."
              saved={settings.hasNvidiaKey || Boolean(caps?.nvidia)}
              placeholder="nvapi-…"
              value={nvidiaKey}
              onChange={setNvidiaKey}
              onSave={() => void persist({ nvidiaApiKey: nvidiaKey })}
              onDelete={() => void persist({ clearNvidia: true })}
              saving={saving}
            />
            <KeyRow
              id="xaikey"
              label="xAI Grok / Imagine"
              hint="Director fallback and face-locked image/video generation."
              saved={settings.hasXaiKey || Boolean(caps?.grok)}
              placeholder="xai-…"
              value={xaiKey}
              onChange={setXaiKey}
              onSave={() => void persist({ xaiApiKey: xaiKey })}
              onDelete={() => void persist({ clearXai: true })}
              saving={saving}
            />
            <KeyRow
              id="composiokey"
              label="Composio"
              hint="Connects and manages Instagram accounts for daily drops."
              saved={settings.hasComposioKey || Boolean(composio?.keyPresent)}
              placeholder="ak_…"
              value={composioKey}
              onChange={setComposioKey}
              onSave={() => void persist({ composioApiKey: composioKey })}
              onDelete={() => void persist({ clearComposio: true })}
              saving={saving}
            />
          </CardBody>
        </Card>

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
              ) : (
                <Badge>{composio?.keyPresent ? "No account" : "Key needed"}</Badge>
              )}
            </div>
            <p className="text-sm text-muted">
              Pick which Instagram account to use, connect a new one, or delete a linked account.
              Connecting opens Composio — sign in as the SE account.
            </p>
            {composio?.error ? <p className="text-sm text-primary">{composio.error}</p> : null}
            <div className="space-y-1.5">
              <Label htmlFor="ig-account">Active account</Label>
              <select
                id="ig-account"
                className="flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                value={settings.composioAccountId}
                onChange={(event) => void persist({ composioAccountId: event.target.value })}
              >
                <option value="">Select an Instagram account</option>
                {(composio?.accounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.username ? `@${account.username.replace(/^@/, "")}` : account.id}
                    {account.status !== "ACTIVE" ? ` · ${account.status}` : ""}
                    {account.accountType ? ` · ${account.accountType}` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedAccount ? (
              <p className="text-sm text-muted">
                Using {selectedAccount.username ? `@${selectedAccount.username}` : selectedAccount.id}{" "}
                ({selectedAccount.status}
                {selectedAccount.accountType ? ` · ${selectedAccount.accountType}` : ""}).
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={connecting || !composio?.keyPresent}
                onClick={async () => {
                  setConnecting(true);
                  try {
                    const res = await fetch("/api/composio/connect", { method: "POST" });
                    const body = (await res.json()) as { ok: boolean; url?: string; error?: string };
                    if (!body.ok || !body.url) throw new Error(body.error || "No connect URL");
                    window.location.assign(body.url);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not start Composio");
                    setConnecting(false);
                  }
                }}
              >
                {connecting ? "Opening Composio…" : "Connect Instagram"}
              </Button>
              <Button variant="outline" onClick={() => void refreshComposio()}>
                Refresh accounts
              </Button>
              {settings.composioAccountId ? (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={async () => {
                    const id = settings.composioAccountId;
                    const res = await fetch(`/api/composio/accounts?id=${encodeURIComponent(id)}`, {
                      method: "DELETE",
                    });
                    const body = (await res.json()) as { ok: boolean; error?: string };
                    if (!body.ok) {
                      toast.error(body.error || "Could not remove account");
                      return;
                    }
                    await persist({ composioAccountId: "" });
                    await refreshComposio();
                    toast.success("Instagram account removed");
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove selected
                </Button>
              ) : null}
            </div>
            {composio?.accounts?.length ? (
              <ul className="space-y-2 text-sm">
                {composio.accounts.map((account) => {
                  const active = account.status === "ACTIVE" && !account.disabled;
                  return (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusDot on={active} />
                      <span className="truncate">
                        {account.username ? `@${account.username.replace(/^@/, "")}` : account.id}
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={active ? "ok" : "muted"}>
                        {account.disabled ? "Disabled" : account.status}
                      </Badge>
                      <Button
                        variant="outline"
                        className="h-8 px-2"
                        onClick={async () => {
                          const res = await fetch(
                            `/api/composio/accounts?id=${encodeURIComponent(account.id)}`,
                            { method: "DELETE" },
                          );
                          const body = (await res.json()) as { ok: boolean; error?: string };
                          if (!body.ok) {
                            toast.error(body.error || "Could not delete account");
                            return;
                          }
                          if (settings.composioAccountId === account.id) {
                            await persist({ composioAccountId: "" });
                          }
                          await refreshComposio();
                          toast.success("Instagram account deleted");
                        }}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {composio ? "No Instagram accounts on this Composio key yet." : "Checking Composio…"}
              </p>
            )}
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
                  onChange={(e) => setSettings({ ...settings, postHour: Number(e.target.value) })}
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
                  onChange={(e) => setSettings({ ...settings, postMinute: Number(e.target.value) })}
                  onBlur={() => void persist({ postMinute: settings.postMinute })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tz">Timezone</Label>
              <Input
                id="tz"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                onBlur={() => void persist({ timezone: settings.timezone })}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
