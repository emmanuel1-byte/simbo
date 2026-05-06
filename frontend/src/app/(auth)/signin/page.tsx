'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { Divider } from '@/components/ui/surface';
import { AuthHeader } from '@/components/auth/auth-header';
import { OAuthButton } from '@/components/auth/oauth-button';
import { ArrowRight, Mail } from '@/components/icons';
import { signinSchema, type SigninValues } from '@/lib/validators/auth';
import { useAuth } from '@/contexts/auth-context';
import type { ApiError } from '@/types';

function SigninInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/ask';
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: SigninValues) {
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name}.`);
      router.replace(next);
    } catch (err) {
      const e = err as ApiError;
      if (e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          setError(field as keyof SigninValues, { message });
        }
      } else {
        setError('password', { message: e.message });
        toast.error(e.message);
      }
    }
  }

  return (
    <>
      <AuthHeader
        title={
          <>
            Welcome back,{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              analyst.
            </em>
          </>
        }
        lead="Sign in to pick up where you left off. Or skip ahead and try Simbo without an account."
      />

      <OAuthButton provider="google" label="Google" className="mb-5" />
      <Divider label="or with email" className="my-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@workspace.com"
            iconLeft={<Mail size={16} />}
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>

        <Field
          label="password"
          htmlFor="password"
          error={errors.password?.message}
          hint={
            <Link
              href="/forgot-password"
              className="text-accent transition-opacity hover:opacity-80"
            >
              Forgot?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            invalid={!!errors.password}
            {...register('password')}
          />
        </Field>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            iconRight={<ArrowRight size={14} />}
            fullWidth
          >
            Sign in
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.push('/signup')}>
            Create account
          </Button>
        </div>
      </form>

      {/* Guest card */}
      <div className="mt-8 flex items-center gap-4 rounded-xl border border-dashed border-rule-2 bg-white/[0.015] p-5">
        <div className="flex-1">
          <b className="block text-sm text-paper">No account? Continue as guest.</b>
          <small className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
            5 queries / session · history not saved
          </small>
        </div>
        <Button variant="secondary" size="sm" onClick={() => router.replace('/ask?guest=1')}>
          Try as guest →
        </Button>
      </div>

      <p className="mt-9 font-mono text-2xs text-muted">
        By continuing you agree to the{' '}
        <span className="text-paper underline underline-offset-2">Terms</span> &amp;{' '}
        <span className="text-paper underline underline-offset-2">Privacy</span>.
      </p>
    </>
  );
}

export default function SigninPage() {
  return (
    <Suspense fallback={null}>
      <SigninInner />
    </Suspense>
  );
}
