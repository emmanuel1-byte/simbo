'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { Toggle } from '@/components/ui/surface';
import { ArrowRight, Check, Database, Lock, Refresh, X } from '@/components/icons';
import { apiKeyApi, connectionsApi } from '@/lib/api';
import { connectionSchema, type ConnectionValues } from '@/lib/validators/connection';
import { cn } from '@/lib/utils/cn';
import type { AiProvider, DbProvider } from '@/types';

const AI_PROVIDERS = [
  { id: 'openai' as AiProvider, name: 'OpenAI', mark: 'A', bg: '#000', color: '#fff', sub: 'GPT-4o, GPT-4o mini', defaultModel: 'gpt-4o' },
  { id: 'anthropic' as AiProvider, name: 'Anthropic', mark: 'C', bg: '#d97757', color: '#fff', sub: 'Claude Opus, Sonnet', defaultModel: 'claude-sonnet-4-6' },
];

const DB_PROVIDERS: Array<{ id: DbProvider; name: string; defaultPort: number; mark: string; bg: string; color: string }> = [
  { id: 'postgres', name: 'Postgres', defaultPort: 5432, mark: 'PG', bg: '#336791', color: '#fff' },
  { id: 'mysql', name: 'MySQL', defaultPort: 3306, mark: 'My', bg: '#00758f', color: '#fff' },
  { id: 'snowflake', name: 'Snowflake', defaultPort: 443, mark: 'Sn', bg: '#29b5e8', color: '#fff' },
  { id: 'bigquery', name: 'BigQuery', defaultPort: 443, mark: 'BQ', bg: '#4285f4', color: '#fff' },
  { id: 'sqlite', name: 'SQLite', defaultPort: 0, mark: 'Lt', bg: '#003b57', color: '#fff' },
];

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; tableCount?: number }
  | { status: 'fail'; error: string };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [keyValue, setKeyValue] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 2
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [connecting, setConnecting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid },
  } = useForm<ConnectionValues>({
    resolver: zodResolver(connectionSchema),
    mode: 'onChange',
    defaultValues: {
      provider: 'postgres',
      name: 'production postgres',
      host: '',
      port: '5432',
      database: '',
      username: '',
      password: '',
      ssl: false,
    },
  });

  const dbProvider = watch('provider');
  const ssl = watch('ssl');

  function pickDbProvider(p: DbProvider) {
    const meta = DB_PROVIDERS.find((x) => x.id === p)!;
    setValue('provider', p, { shouldValidate: true });
    if (meta.defaultPort) setValue('port', String(meta.defaultPort));
    const currentName = getValues('name');
    if (!currentName || /^(production|new) /.test(currentName)) {
      setValue('name', `production ${meta.name.toLowerCase()}`);
    }
    setTestState({ status: 'idle' });
  }

  async function handleSaveKey(skip: boolean) {
    if (!skip) {
      if (!keyValue.trim()) {
        toast.error('Paste an API key first, or skip this step.');
        return;
      }
      setSaving(true);
      try {
        const model = AI_PROVIDERS.find((p) => p.id === aiProvider)?.defaultModel ?? 'gpt-4o';
        await apiKeyApi.save(aiProvider, model, keyValue.trim());
        toast.success('API key saved. Encrypted at rest.');
      } catch {
        toast.error('Could not save the key. You can add it later in Settings → API key.');
      } finally {
        setSaving(false);
      }
    }
    setStep(2);
  }

  async function handleTest() {
    const values = getValues();
    setTestState({ status: 'testing' });
    try {
      const r = await connectionsApi.probe({
        ...values,
        port: values.port ? Number(values.port) : undefined,
      });
      if (r.ok) {
        setTestState({ status: 'ok', tableCount: r.tableCount });
      } else {
        setTestState({ status: 'fail', error: r.error ?? 'Connection failed.' });
      }
    } catch (err) {
      setTestState({
        status: 'fail',
        error: err instanceof Error ? err.message : 'Could not reach the database.',
      });
    }
  }

  async function handleConnect(values: ConnectionValues) {
    setConnecting(true);
    try {
      const created = await connectionsApi.create({
        ...values,
        port: values.port ? Number(values.port) : undefined,
      });
      await connectionsApi.test(created.id).catch(() => null);
      toast.success(`${created.name} connected. Welcome to Simbo.`);
      router.replace(`/chat/new_${Date.now()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the connection.');
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-paper flex flex-col">

      {/* Nav */}
      <div className="border-b border-rule px-8 py-4 flex items-center justify-between">
        <Link href="/" className="font-serif text-[17px] italic text-accent">simbo</Link>

        {/* Step indicators */}
        <div className="flex items-center gap-1">
          {([1, 2] as const).map((n, i) => (
            <div key={n} className="flex items-center gap-1.5">
              {i > 0 && <span className="mx-1 h-px w-6 bg-rule-2" />}
              <div
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full font-mono text-[11px] font-medium transition-colors',
                  n < step ? 'bg-accent text-paper-inv'
                    : n === step ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                    : 'border border-rule-2 text-muted',
                )}
              >
                {n < step ? <Check size={11} /> : n}
              </div>
              <span className={cn(
                'font-mono text-[11px] transition-colors',
                n === step ? 'text-paper' : 'text-muted',
              )}>
                {n === 1 ? 'AI key' : 'Database'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-[560px]">

          {/* ── Step 1: AI API key ──────────────────────────────────────── */}
          {step === 1 && (
            <>
              <p className="label-eyebrow mb-5">Step 1 of 2, optional</p>
              <h1 className="font-serif text-[38px] font-normal leading-[1.1] tracking-[-0.025em] text-paper">
                Bring your own<br />
                <em className="text-accent" style={{ fontStyle: 'italic' }}>AI key.</em>
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.75] text-paper-2">
                Skip and Simbo uses a shared Gemini key automatically. Add your own
                OpenAI or Anthropic key to unlock frontier models and pay your provider
                directly. No markup, no limits imposed by us. Encrypted at rest.
              </p>

              <div className="mt-8 rounded-xl border border-rule-2 bg-ink-3 p-6">
                <div className="grid grid-cols-2 gap-3">
                  {AI_PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAiProvider(p.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border bg-ink-2 p-4 text-left transition-all',
                        aiProvider === p.id
                          ? 'border-accent shadow-[0_0_0_3px_rgba(212,130,10,0.1)]'
                          : 'border-rule hover:border-rule-2',
                      )}
                    >
                      <div
                        className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md font-mono text-[14px] font-bold"
                        style={{ background: p.bg, color: p.color }}
                      >
                        {p.mark}
                      </div>
                      <div>
                        <div className="text-[13px] font-medium">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted">{p.sub}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-5">
                  <Field label="api key" htmlFor="api-key">
                    <Input
                      id="api-key"
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

                <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <Lock size={11} />
                  AES-256 envelope encryption, per-user keys, never logged
                </div>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <Button
                  variant="primary"
                  size="lg"
                  loading={saving}
                  onClick={() => handleSaveKey(false)}
                  iconRight={<ArrowRight size={14} />}
                >
                  Save key & continue
                </Button>
                <button
                  type="button"
                  onClick={() => handleSaveKey(true)}
                  className="font-mono text-[12px] text-muted underline underline-offset-4 transition-colors hover:text-paper"
                >
                  Skip, use shared AI
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Database connection ─────────────────────────────── */}
          {step === 2 && (
            <>
              <p className="label-eyebrow mb-5">Step 2 of 2, required</p>
              <h1 className="font-serif text-[38px] font-normal leading-[1.1] tracking-[-0.025em] text-paper">
                Connect your<br />
                <em className="text-accent" style={{ fontStyle: 'italic' }}>database.</em>
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.75] text-paper-2">
                Simbo needs read-only access to answer questions about your data.
                Use a read replica or a dedicated read-only role. Writes are
                blocked at the parser, not just by permissions.
              </p>

              <div className="mt-8 rounded-xl border border-rule-2 bg-ink-3 p-6">
                <form className="flex flex-col gap-5">
                  <div>
                    <label className="label-eyebrow mb-2.5 block">database type</label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {DB_PROVIDERS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickDbProvider(p.id)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all',
                            dbProvider === p.id
                              ? 'border-accent bg-accent/5'
                              : 'border-rule bg-ink hover:border-rule-2',
                          )}
                        >
                          <div
                            className="grid h-7 w-7 place-items-center rounded-md font-mono text-[11px] font-bold"
                            style={{ background: p.bg, color: p.color }}
                          >
                            {p.mark}
                          </div>
                          <div className="text-[11px] font-medium">{p.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Field label="connection name" htmlFor="ob-name" error={errors.name?.message}>
                    <Input
                      id="ob-name"
                      placeholder="production postgres"
                      iconLeft={<Database size={16} />}
                      invalid={!!errors.name}
                      {...register('name')}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
                    <Field label="host" htmlFor="ob-host" error={errors.host?.message}>
                      <Input id="ob-host" placeholder="db.acme.internal" mono invalid={!!errors.host} {...register('host')} />
                    </Field>
                    <Field label="port" htmlFor="ob-port" error={errors.port?.message}>
                      <Input id="ob-port" mono invalid={!!errors.port} {...register('port')} />
                    </Field>
                  </div>

                  <Field label="database name" htmlFor="ob-database" error={errors.database?.message}>
                    <Input id="ob-database" placeholder="acme_prod" mono invalid={!!errors.database} {...register('database')} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="username" htmlFor="ob-username" error={errors.username?.message}>
                      <Input id="ob-username" placeholder="readonly_user" mono invalid={!!errors.username} {...register('username')} />
                    </Field>
                    <Field label="password" htmlFor="ob-password" error={errors.password?.message}>
                      <PasswordInput id="ob-password" placeholder="••••••••" invalid={!!errors.password} {...register('password')} />
                    </Field>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-rule bg-ink p-3.5">
                    <Lock size={16} className="text-accent" />
                    <div className="flex-1">
                      <b className="block text-[13px] font-medium">Use TLS / SSL</b>
                      <small className="font-mono text-[11px] text-muted">Strongly recommended for production databases.</small>
                    </div>
                    <Toggle checked={!!ssl} onChange={(v) => setValue('ssl', v)} label="Use SSL" />
                  </div>

                  {/* Test row */}
                  <div className={cn(
                    'flex items-center gap-3 rounded-xl border p-4 transition-colors',
                    testState.status === 'ok' && 'border-accent/40 bg-accent/5',
                    testState.status === 'fail' && 'border-warn/40 bg-warn/5',
                    (testState.status === 'idle' || testState.status === 'testing') && 'border-dashed border-rule-2 bg-white/[0.015]',
                  )}>
                    {testState.status === 'ok' && (
                      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-accent/20 text-accent">
                        <Check size={14} />
                      </span>
                    )}
                    {testState.status === 'fail' && (
                      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-warn/20 text-warn">
                        <X size={14} />
                      </span>
                    )}
                    {(testState.status === 'idle' || testState.status === 'testing') && (
                      <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg border border-rule-2 text-muted">
                        <Database size={14} />
                      </span>
                    )}
                    <div className="flex-1">
                      {testState.status === 'idle' && (
                        <>
                          <b className="block text-[13px] font-medium">Test before you connect.</b>
                          <small className="font-mono text-[11px] text-muted">We verify connectivity and read permissions only.</small>
                        </>
                      )}
                      {testState.status === 'testing' && (
                        <>
                          <b className="block text-[13px] font-medium">Reaching {watch('host') || 'host'}…</b>
                          <small className="font-mono text-[11px] text-muted">Hold tight.</small>
                        </>
                      )}
                      {testState.status === 'ok' && (
                        <>
                          <b className="block text-[13px] font-medium text-accent">Connected successfully</b>
                          <small className="font-mono text-[11px] text-muted">{testState.tableCount ?? 0} tables visible to your role.</small>
                        </>
                      )}
                      {testState.status === 'fail' && (
                        <>
                          <b className="block text-[13px] font-medium text-warn">Connection failed</b>
                          <small className="font-mono text-[11px] text-muted">{testState.error}</small>
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      iconLeft={<Refresh size={12} />}
                      onClick={handleTest}
                      loading={testState.status === 'testing'}
                      disabled={!isValid}
                    >
                      {testState.status === 'ok' ? 'Re-test' : 'Test connection'}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="mt-6 flex items-center gap-5">
                <Button
                  variant="primary"
                  size="lg"
                  loading={connecting}
                  onClick={handleSubmit(handleConnect)}
                  disabled={testState.status !== 'ok'}
                  iconRight={<ArrowRight size={14} />}
                >
                  Connect & start querying
                </Button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="font-mono text-[12px] text-muted transition-colors hover:text-paper"
                >
                  ← Back
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
