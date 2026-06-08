'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Pill } from '@/components/ui/pill';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { SettingsHeader } from '@/components/app/settings-header';
import { EmptyState, NoApiKeyIllustration } from '@/components/empty-states/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { apiKeyApi } from '@/lib/api';
import { ArrowRight, Lock, Refresh, Trash } from '@/components/icons';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { formatRelative } from '@/lib/utils/format';
import type { AiProvider, ApiKeyMeta } from '@/types';

const providers: Array<{ id: AiProvider; name: string; mark: string; bg: string; color: string; sub: string; defaultModel: string }> = [
  { id: 'openai', name: 'OpenAI', mark: 'A', bg: '#000', color: '#fff', sub: 'gpt-4o · gpt-4o-mini', defaultModel: 'gpt-4o' },
  { id: 'anthropic', name: 'Anthropic', mark: 'C', bg: '#d97757', color: '#fff', sub: 'claude-opus-4-8 · claude-sonnet-4-6', defaultModel: 'claude-sonnet-4-6' },
];

export default function ApiKeyPage() {
  const [current, setCurrent] = useState<ApiKeyMeta | null | undefined>(undefined); // undefined = loading
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [keyValue, setKeyValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; provider: string; model: string } | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [rotateKey, setRotateKey] = useState('');
  const [rotating, setRotating] = useState(false);

  async function load() {
    try {
      setCurrent(await apiKeyApi.get());
    } catch {
      setCurrent(null);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function handleSave() {
    if (!keyValue.trim()) {
      toast.error('Paste a key first.');
      return;
    }
    setSaving(true);
    try {
      const model = providers.find((p) => p.id === provider)?.defaultModel ?? 'gpt-4o';
      const meta = await apiKeyApi.save(provider, model, keyValue.trim());
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
      toast.success(`Connection verified · ${r.model}`);
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
      await apiKeyApi.revoke();
      toast.success('Key revoked.');
    } catch {
      toast.error('Could not revoke. Try again.');
      void load();
    } finally {
      setRevoking(false);
      setShowRevokeConfirm(false);
    }
  }

  async function handleConfirmRotate() {
    if (!rotateKey.trim()) {
      toast.error('Paste a new key first.');
      return;
    }
    setRotating(true);
    try {
      const model = providers.find((p) => p.id === current?.provider)?.defaultModel ?? 'gpt-4o';
      const meta = await apiKeyApi.rotate(rotateKey.trim(), model);
      setCurrent(meta);
      setRotateKey('');
      setShowRotate(false);
      toast.success('Key rotated. Past results are preserved.');
    } catch {
      toast.error('Could not rotate. Try again.');
    } finally {
      setRotating(false);
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
              Upgrade your{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                AI.
              </em>
            </>
          }
          lead="Simbo works out of the box with a built-in AI. Add your own OpenAI or Anthropic key to unlock more powerful models — encrypted at rest, never logged."
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
                    ? 'border-accent shadow-[0_0_0_3px_rgba(124,133,240,0.1)]'
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
                Why add{' '}
                <em className="text-accent" style={{ fontStyle: 'italic' }}>
                  your own key.
                </em>
              </>
            }
            description="The built-in AI handles most queries well. Your own key gives you access to GPT-4o, Claude Opus, and other frontier models — with your prompts going directly to the provider, not through us."
          />
        </div>
      </>
    );
  }

  // Connected state
  const providerInfo = providers.find((p) => p.id === current.provider) ?? providers[0];
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
              <Pill variant="safe">{current.isActive ? 'active' : 'inactive'}</Pill>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {current.keyHint} · added {formatRelative(current.createdAt)}
              {current.lastUsedAt && ` · last used ${formatRelative(current.lastUsedAt)}`}
            </div>
          </div>
        </div>

        {testResult && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 font-mono text-[12px] text-accent animate-fade-in">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Connection verified · {testResult.model}
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
          <Button variant="secondary" size="sm" onClick={() => setShowRotate(true)}>
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

      <Modal
        open={showRotate}
        onClose={() => { setShowRotate(false); setRotateKey(''); }}
        size="sm"
        title={
          <>
            Rotate{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              API key
            </em>
          </>
        }
        description="Paste your new key. The old key is invalidated immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowRotate(false); setRotateKey(''); }} disabled={rotating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmRotate} loading={rotating}>
              Rotate key
            </Button>
          </>
        }
      >
        <Field label="new api key" htmlFor="rotate-key">
          <Input
            id="rotate-key"
            mono
            type="password"
            placeholder="sk-proj-..."
            value={rotateKey}
            onChange={(e) => setRotateKey(e.target.value)}
          />
        </Field>
      </Modal>
    </>
  );
}
