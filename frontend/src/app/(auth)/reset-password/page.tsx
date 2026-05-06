'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, PasswordInput } from '@/components/ui/input';
import { AuthHeader } from '@/components/auth/auth-header';
import { ArrowLeft, ArrowRight, Check } from '@/components/icons';
import { resetSchema, type ResetValues } from '@/lib/validators/auth';
import { authApi } from '@/lib/api';
import type { ApiError } from '@/types';
import { cn } from '@/lib/utils/cn';

function ResetInner() {
  const router = useRouter();
  const search = useSearchParams();
  const email = search.get('email') ?? '';
  const code = search.get('code') ?? '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code, password: '', confirm: '' },
  });

  useEffect(() => {
    setValue('code', code);
    if (!email || !code) router.replace('/forgot-password');
  }, [email, code, router, setValue]);

  const password = watch('password');
  const passwordChecks = [
    { label: '8+ characters', ok: (password ?? '').length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password ?? '') },
    { label: 'Lowercase', ok: /[a-z]/.test(password ?? '') },
    { label: 'Number', ok: /[0-9]/.test(password ?? '') },
  ];

  async function onSubmit(values: ResetValues) {
    try {
      await authApi.resetPassword(email, values.code, values.password);
      toast.success('Password updated. Sign in with your new password.');
      router.replace('/signin');
    } catch (err) {
      const e = err as ApiError;
      setError('password', { message: e.message });
      toast.error(e.message);
    }
  }

  return (
    <>
      <Link
        href="/signin"
        className="mb-8 inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-paper"
      >
        <ArrowLeft size={12} /> back to sign in
      </Link>

      <AuthHeader
        title={
          <>
            Set a new{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              password.
            </em>
          </>
        }
        lead={`Choose something memorable, but not too memorable. Resetting for ${email}.`}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register('code')} />

        <Field label="new password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            invalid={!!errors.password}
            {...register('password')}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {passwordChecks.map((c) => (
              <span
                key={c.label}
                className={cn(
                  'inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                  c.ok
                    ? 'border-accent/40 bg-accent/5 text-accent'
                    : 'border-rule text-muted',
                )}
              >
                {c.ok && <Check size={10} />} {c.label}
              </span>
            ))}
          </div>
        </Field>

        <Field label="confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder="Type it again"
            invalid={!!errors.confirm}
            {...register('confirm')}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          iconRight={<ArrowRight size={14} />}
          fullWidth
          className="mt-3"
        >
          Reset password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
