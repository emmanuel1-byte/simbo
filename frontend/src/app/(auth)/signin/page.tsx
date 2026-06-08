'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { AuthHeader } from '@/components/auth/auth-header';
import { ArrowRight, Mail } from '@/components/icons';
import { signinSchema, type SigninValues } from '@/lib/validators/auth';
import { useAuth } from '@/contexts/auth-context';
import type { ApiError } from '@/types';

function SigninInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next   = search.get('next') ?? `/chat/new_${Date.now()}`;
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
            <em className="text-accent" style={{ fontStyle: 'italic' }}>analyst.</em>
          </>
        }
        lead="Sign in to pick up where you left off."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Field label="email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@workspace.com"
            iconLeft={<Mail size={15} />}
            invalid={!!errors.email}
            {...register('email')}
          />
        </Field>

        <Field
          label="password"
          htmlFor="password"
          error={errors.password?.message}
          hint={
            <Link href="/forgot-password" className="text-accent transition-opacity hover:opacity-75">
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

        <div className="mt-2 flex flex-col gap-3">
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
          <Button
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => router.push('/signup')}
          >
            Create account
          </Button>
        </div>
      </form>
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
