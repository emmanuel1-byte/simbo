'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/modal';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/surface';
import { Check, Database, Lock, Refresh, X } from '@/components/icons';
import { cn } from '@/lib/utils/cn';
import { connectionSchema, type ConnectionValues } from '@/lib/validators/connection';
import { connectionsApi } from '@/lib/api';
import type { DbConnection, DbProvider } from '@/types';

interface AddConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (conn: DbConnection) => void;
}

const PROVIDERS: Array<{
  id: DbProvider;
  name: string;
  defaultPort: number;
  mark: string;
  bg: string;
  color: string;
}> = [
  { id: 'postgres', name: 'Postgres', defaultPort: 5432, mark: 'PG', bg: '#336791', color: '#fff' },
  { id: 'mysql', name: 'MySQL', defaultPort: 3306, mark: 'My', bg: '#00758f', color: '#fff' },
  { id: 'snowflake', name: 'Snowflake', defaultPort: 443, mark: 'Sn', bg: '#29b5e8', color: '#fff' },
  { id: 'bigquery', name: 'BigQuery', defaultPort: 443, mark: 'BQ', bg: '#4285f4', color: '#fff' },
  { id: 'sqlite', name: 'SQLite', defaultPort: 0, mark: 'Lt', bg: '#003b57', color: '#fff' },
];

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number; tablesCount?: number }
  | { status: 'fail'; error: string };

export function AddConnectionModal({ open, onClose, onCreated }: AddConnectionModalProps) {
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors, isValid },
  } = useForm<ConnectionValues>({
    resolver: zodResolver(connectionSchema),
    mode: 'onChange',
    defaultValues: {
      provider: 'postgres',
      name: 'production · postgres',
      host: '',
      port: '5432',
      database: '',
      username: '',
      password: '',
      ssl: true,
    },
  });

  const provider = watch('provider');
  const ssl = watch('ssl');

  // Reset state when reopened
  useEffect(() => {
    if (!open) {
      reset();
      setTestState({ status: 'idle' });
    }
  }, [open, reset]);

  // Update default port + name when provider changes
  function pickProvider(p: DbProvider) {
    const meta = PROVIDERS.find((x) => x.id === p)!;
    setValue('provider', p, { shouldValidate: true });
    if (meta.defaultPort) setValue('port', String(meta.defaultPort));
    // Update placeholder name too if user hasn't customized
    const currentName = getValues('name');
    if (!currentName || /^(production|new) ·/.test(currentName)) {
      setValue('name', `production · ${meta.name.toLowerCase()}`);
    }
    setTestState({ status: 'idle' });
  }

  async function handleTest() {
    const values = getValues();
    setTestState({ status: 'testing' });
    try {
      const r = await connectionsApi.testCredentials({
        ...values,
        port: values.port ? Number(values.port) : undefined,
      });
      if (r.ok) {
        setTestState({ status: 'ok', latencyMs: r.latencyMs, tablesCount: r.tablesCount });
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

  async function onSubmit(values: ConnectionValues) {
    setSaving(true);
    try {
      const created = await connectionsApi.create({
        ...values,
        port: values.port ? Number(values.port) : undefined,
      });
      toast.success(`${created.name} is ready to query.`);
      onCreated?.(created);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the connection.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add a database connection"
      description="Simbo connects with read-only credentials only. Test before saving."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            loading={saving}
            disabled={!isValid || testState.status !== 'ok'}
          >
            Save connection
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Provider picker */}
        <div>
          <label className="label-eyebrow mb-2.5 block">database type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickProvider(p.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all',
                  provider === p.id
                    ? 'border-accent bg-accent/5'
                    : 'border-rule bg-ink hover:border-rule-2',
                )}
              >
                <div
                  className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold"
                  style={{ background: p.bg, color: p.color }}
                >
                  {p.mark}
                </div>
                <div className="text-[13px] font-medium">{p.name}</div>
              </button>
            ))}
          </div>
        </div>

        <Field label="connection name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            placeholder="production · postgres"
            iconLeft={<Database size={16} />}
            invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <Field label="host" htmlFor="host" error={errors.host?.message}>
            <Input
              id="host"
              placeholder="db.acme.internal"
              mono
              invalid={!!errors.host}
              {...register('host')}
            />
          </Field>
          <Field label="port" htmlFor="port" error={errors.port?.message}>
            <Input id="port" mono invalid={!!errors.port} {...register('port')} />
          </Field>
        </div>

        <Field label="database name" htmlFor="database" error={errors.database?.message}>
          <Input
            id="database"
            placeholder="acme_prod"
            mono
            invalid={!!errors.database}
            {...register('database')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="username" htmlFor="username" error={errors.username?.message}>
            <Input
              id="username"
              placeholder="readonly_user"
              mono
              invalid={!!errors.username}
              {...register('username')}
            />
          </Field>
          <Field label="password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              invalid={!!errors.password}
              {...register('password')}
            />
          </Field>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-rule bg-ink p-3.5">
          <Lock size={16} className="text-accent" />
          <div className="flex-1">
            <b className="block text-[13px] font-medium">Use TLS / SSL</b>
            <small className="font-mono text-[11px] text-muted">
              Strongly recommended for production databases.
            </small>
          </div>
          <Toggle
            checked={!!ssl}
            onChange={(v) => setValue('ssl', v)}
            label="Use SSL"
          />
        </div>

        {/* Test row */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl border p-4 transition-colors',
            testState.status === 'ok' && 'border-accent/40 bg-accent/5',
            testState.status === 'fail' && 'border-warn/40 bg-warn/5',
            (testState.status === 'idle' || testState.status === 'testing') &&
              'border-dashed border-rule-2 bg-white/[0.015]',
          )}
        >
          {testState.status === 'ok' && (
            <span
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-accent/20 text-accent"
              style={{ boxShadow: '0 0 12px rgba(211,255,58,0.3)' }}
            >
              <Check size={14} />
            </span>
          )}
          {testState.status === 'fail' && (
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-warn/20 text-warn">
              <X size={14} />
            </span>
          )}
          {(testState.status === 'idle' || testState.status === 'testing') && (
            <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full border border-rule-2 text-muted">
              <Database size={14} />
            </span>
          )}

          <div className="flex-1">
            {testState.status === 'idle' && (
              <>
                <b className="block text-[13px] font-medium">
                  Test before you save.
                </b>
                <small className="font-mono text-[11px] text-muted">
                  We'll verify connectivity and read permissions only.
                </small>
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
                <b className="block text-[13px] font-medium text-accent">
                  Connected · responded in {testState.latencyMs}ms
                </b>
                <small className="font-mono text-[11px] text-muted">
                  {testState.tablesCount ?? 0} tables visible to your role.
                </small>
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
    </Modal>
  );
}
