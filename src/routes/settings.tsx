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
          ? "inline-block size-2.5 shrink-0 rounded-full bg-ok shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-ok)_28%,transparent)]"
          : "inline-block size-2.5 shrink-0 rounded-full bg-secondary"
      }
    />
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <Label htmlFor={htmlFor} className="text-[10px] uppercase tracking-[0.16em] text-muted">
      {children}
    </Label>
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
    <div className="space-y-3 rounded-xl border border-border bg-bg p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <StatusDot on={saved} />
          <p className="font-serif text-lg leading-none">{label}</p>
        </div>
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
  const [refreshing, setRefreshing] = useState(false);
  const [composio, setComposio] = useState<ComposioStatus | null>(null);

  async function refreshComposio(showToast = false) {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/composio/status?ts=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) throw new Error(`Composio status ${res.status}`);
      const body = (await res.json()) as ComposioStatus;
      setComposio(body);
      if (showToast) {
        toast.success(
          body.accounts.length
            ? `${body.accounts.length} Instagram account${body.accounts.length === 1 ? "" : "s"}`
            : "No Instagram accounts on this key",
        );
      }
      return body;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh Composio";
      if (showToast) toast.error(message);
      throw error;
    } finally {
      setRefreshing(false);
    }
  }

  // Load studio state + Composio status on mount.
  // Also auto-populate composio_account_id in the DB if Composio has an active
  // Instagram account but the DB doesn't — so publishPost can find it.
  useEffect(() => {
    void getStudioState().then(async (s) => {
      setSettings(s.settings);
      setCaps(s.capabilities);

      // Auto-save composio_account_id if an active IG account exists in Composio
      if (s.settings.composioAccountId) return;
      try {
        const res = await fetch("/api/composio/status", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as ComposioStatus;
        const active = body.accounts.find(
          (a) => a.status === "ACTIVE" && !a.disabled,
        );
        if (!active) return;
        await saveSettings({
          data: { composioAccountId: active.id },
        });
        setSettings((prev) =>
          prev ? { ...prev, composioAccountId: active.id } : prev,
        );
        toast.success(`Instagram (${active.username ?? active.id}) saved`);
      } catch {
        // Non-fatal — just skip auto-populate
      }
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
      <AppShell eyebrow="Studio settings">
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
    <AppShell eyebrow="Studio settings" nvidia={caps?.nvidia}>
      <div className="mb-6">
        <h2 className="font-serif text-3xl tracking-tight">The vault</h2>
        <p className="mt-1 text-sm text-muted">
          Keys, Instagram, and the daily drop — same workspace as Create.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <h3 className="font-serif text-2xl">AI keys</h3>
            </div>
            <p className="text-sm text-muted">
              Add or replace NVIDIA, xAI, and Composio. Env keys stay as fallback until you save one
              here.
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
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Instagram className="size-4 text-primary" />
              <h3 className="font-serif text-2xl">Instagram</h3>
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
              Connect through Composio only. Pick the SE account, or delete a leftover connection.
            </p>
            {composio?.error ? <p className="text-sm text-primary">{composio.error}</p> : null}
            <div className="space-y-1.5">
              <FieldLabel htmlFor="ig-account">Active account</FieldLabel>
              <select
                id="ig-account"
                className="flex h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={selectedAccount?.id ?? settings.composioAccountId}
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
              <p className="inline-flex items-center gap-2 text-sm text-muted">
                <StatusDot on={selectedAccount.status === "ACTIVE" && !selectedAccount.disabled} />
                Using {selectedAccount.username ? `@${selectedAccount.username}` : selectedAccount.id}
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
              <Button
                variant="outline"
                disabled={refreshing}
                onClick={() => void refreshComposio(true)}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
            {composio?.accounts?.length ? (
              <ul className="space-y-3">
                {composio.accounts.map((account) => {
                  const active = account.status === "ACTIVE" && !account.disabled;
                  const label = account.username
                    ? `@${account.username.replace(/^@/, "")}`
                    : account.id;
                  return (
                    <li
                      key={account.id}
                      className="space-y-2 rounded-xl border border-border bg-bg p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <StatusDot on={active} />
                          <span className="truncate text-sm font-medium">{label}</span>
                        </span>
                        <Badge tone={active ? "ok" : "muted"}>
                          {account.disabled ? "Disabled" : account.status}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid={`delete-ig-${account.id}`}
                        onClick={async () => {
                          const id = account.id;
                          setComposio((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  accounts: prev.accounts.filter((item) => item.id !== id),
                                  accountCount: Math.max(0, prev.accountCount - 1),
                                  connected: prev.accounts.some(
                                    (item) => item.id !== id && item.status === "ACTIVE" && !item.disabled,
                                  ),
                                }
                              : prev,
                          );
                          const res = await fetch(
                            `/api/composio/accounts?id=${encodeURIComponent(id)}`,
                            { method: "DELETE" },
                          );
                          const body = (await res.json()) as {
                            ok: boolean;
                            error?: string;
                            remaining?: ComposioAccount[];
                          };
                          if (!body.ok) {
                            toast.error(body.error || "Could not delete account");
                            await refreshComposio();
                            return;
                          }
                          if (body.remaining) {
                            setComposio((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    accounts: body.remaining!.filter((item) => item.id !== id),
                                    accountCount: body.remaining!.filter((item) => item.id !== id).length,
                                    connected: body.remaining!.some(
                                      (item) => item.id !== id && item.status === "ACTIVE" && !item.disabled,
                                    ),
                                  }
                                : prev,
                            );
                          }
                          if (settings.composioAccountId === id) {
                            await persist({ composioAccountId: "" });
                          }
                          toast.success("Instagram account deleted");
                        }}
                      >
                        Delete
                      </Button>
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
      </div>

      <Card className="mt-4">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl">Daily drop</h3>
              <p className="mt-1 text-sm text-muted">
                Post exactly once per day. Later items wait their turn.
              </p>
            </div>
            <Switch
              checked={settings.autoPublish}
              onCheckedChange={(autoPublish) => void persist({ autoPublish })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <FieldLabel htmlFor="hour">Hour</FieldLabel>
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
              <FieldLabel htmlFor="minute">Minute</FieldLabel>
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
            <div className="space-y-1.5">
              <FieldLabel htmlFor="tz">Timezone</FieldLabel>
              <Input
                id="tz"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                onBlur={() => void persist({ timezone: settings.timezone })}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </AppShell>
  );
}
