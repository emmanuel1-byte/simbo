'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { ConfirmDialog } from '@/components/ui/modal';
import { SettingsHeader } from '@/components/app/settings-header';
import { EmptyState, NoApiKeyIllustration } from '@/components/empty-states/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiKeyApi } from '@/lib/api';
import { ArrowRight, Lock, Refresh, Trash } from '@/components/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/format';
import type { AiProvider, ApiKeyMeta } from '@/types';

const providers: Array<{ id: AiProvider; name: string; mark: string; bg: string; color: string; sub: string }> = [
  { id: 'openai', name: 'OpenAI', mark: 'A', bg: '#000', color: '#fff', sub: 'gpt-4o · gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic', mark: 'C', bg: '#d97757', color: '#fff', sub: 'claude opus · sonnet' },
  { id: 'google', name: 'Google', mark: 'G', bg: '#4285f4', color: '#fff', sub: 'gemini 2.5 pro' },
];

export default function ApiKeyPage() {
  const [current, setCurrent] = useState<ApiKeyMeta | null | undefined>(undefined); // undefined = loading
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [keyValue, setKeyValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number; model: string } | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  async function load() {
    setCurrent(await apiKeyApi.get());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!keyValue.trim()) {
      toast.error('Paste a key first.');
      return;
    }
    setSaving(true);
    try {
      const meta = await apiKeyApi.save(provider, keyValue.trim());
      setCurrent(meta);
      setKeyValue('');
      toast.success('API key saved and encrypted at rest.');
    } catch {
      toast.error('Could not save the key. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await apiKeyApi.test();
      setTestResult(r);
      toast.success(`Connection verified · ${r.latencyMs}ms`);
    } catch {
      toast.error('Test failed. Verify the key and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleConfirmRevoke() {
    setRevoking(true);
    setCurrent(null);
    try {
      await apiKeyApi.remove();
      toast.success('Key revoked.');
    } catch {
      toast.error('Could not revoke. Try again.');
      load();
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  }

  // Loading state
  if (current === undefined) {
    return (
      <>
        <SettingsHeader title="API key." lead="Loading…" />
        <Card>
          <Skeleton className="h-32 w-full" />
        </Card>
      </>
    );
  }

  // Empty state — no key configured
  if (current === null) {
    return (
      <>
        <SettingsHeader
          title={
            <>
              Bring your own{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                AI.
              </em>
            </>
          }
          lead="Simbo doesn't ship its own LLM. You bring a key — we encrypt it at rest, never log requests, and you can revoke it any time."
        />

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-ink-2 p-4 text-left transition-all',
                  provider === p.id
                    ? 'border-accent shadow-[0_0_0_3px_rgba(211,255,58,0.1)]'
                    : 'border-rule hover:border-rule-2',
                )}
              >
                <div
                  className="grid h-[30px] w-[30px] place-items-center rounded-md font-mono text-[14px] font-bold"
                  style={{ background: p.bg, color: p.color }}
                >
                  {p.mark}
                </div>
                <div>
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="font-mono text-[10px] text-muted">{p.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-7">
            <Field label="api key" htmlFor="key">
              <Input
                id="key"
                mono
                type={reveal ? 'text' : 'password'}
                placeholder="sk-proj-..."
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                iconRight={
                  <button
                    type="button"
                    onClick={() => setReveal((r) => !r)}
                    className="font-mono text-[11px] text-muted transition-colors hover:text-paper"
                  >
                    {reveal ? 'hide' : 'show'}
                  </button>
                }
              />
            </Field>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button
              variant="primary"
              loading={saving}
              onClick={handleSave}
              iconRight={<ArrowRight size={14} />}
            >
              Save and encrypt
            </Button>
            <span className="font-mono text-[11px] text-muted">
              <Lock size={12} className="mr-1.5 inline align-middle" />
              AES-256 envelope encryption · per-user keys
            </span>
          </div>
        </Card>

        <div className="mt-9">
          <EmptyState
            illustration={<NoApiKeyIllustration />}
            title={
              <>
                Why we ask for{' '}
                <em className="text-accent" style={{ fontStyle: 'italic' }}>
                  your key.
                </em>
              </>
            }
            description="Simbo is a thin, transparent layer over your data. Using your own provider key means your queries, prompts, and embeddings never touch our billing — and you keep full control."
          />
        </div>
      </>
    );
  }

  // Connected state
  const providerInfo = providers.find((p) => p.id === current.provider)!;
  return (
    <>
      <SettingsHeader
        title={
          <>
            Your{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              API key.
            </em>
          </>
        }
        lead="Currently active. Past results stay if you rotate or revoke."
      />

      <Card>
        <div className="flex items-start gap-4">
          <div
            className="grid h-[40px] w-[40px] flex-shrink-0 place-items-center rounded-md font-mono text-[15px] font-bold"
            style={{ background: providerInfo.bg, color: providerInfo.color }}
          >
            {providerInfo.mark}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <b className="text-[15px] font-medium text-paper">
                {providerInfo.name} · {current.model}
              </b>
              <Pill variant="safe">{current.status}</Pill>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              sk-proj-···{current.lastFour} · added {formatRelative(current.addedAt)}
              {current.lastUsedAt && ` · last used ${formatRelative(current.lastUsedAt)}`}
            </div>
          </div>
        </div>

        {testResult && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 font-mono text-[12px] text-accent animate-fade-in">
            <span
              className="h-2 w-2 rounded-full bg-accent"
              style={{ boxShadow: '0 0 6px #d3ff3a' }}
            />
            Connection verified · responded in {testResult.latencyMs}ms · model{' '}
            {testResult.model}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Refresh size={12} />}
            loading={testing}
            onClick={handleTest}
          >
            Test connection
          </Button>
          <Button variant="secondary" size="sm">
            Rotate
          </Button>
          <Button
            variant="danger"
            size="sm"
            iconLeft={<Trash size={12} />}
            onClick={() => setShowRevokeConfirm(true)}
          >
            Revoke
          </Button>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="flex items-start gap-4">
          <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-accent/10 text-accent">
            <Lock size={16} />
          </div>
          <div>
            <h4 className="m-0 mb-1 text-[14px] font-medium">Your key, your data — encrypted at rest.</h4>
            <p className="m-0 max-w-[540px] text-[12.5px] text-muted">
              We use AES-256 envelope encryption with per-user keys. We do not log prompt or response
              bodies. Revoke any time and Simbo immediately stops using the key.
            </p>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={showRevokeConfirm}
        onClose={() => setShowRevokeConfirm(false)}
        onConfirm={handleConfirmRevoke}
        loading={revoking}
        destructive
        title={
          <>
            Revoke this{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              API key?
            </em>
          </>
        }
        description="Simbo will immediately stop using this key. Past results stay visible. To run new queries you'll need to add a key again."
        confirmLabel="Yes, revoke"
      />
    </>
  );
}
