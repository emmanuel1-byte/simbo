'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { AuthHeader } from '@/components/auth/auth-header';
import { ArrowLeft, ArrowRight, Mail, Check } from '@/components/icons';
import { authApi } from '@/lib/api';
import { forgotSchema, type ForgotValues } from '@/lib/validators/auth';
import type { ApiError } from '@/types';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotValues) {
    try {
      await authApi.forgotPassword(values.email);
      setSent(values.email);
    } catch (err) {
      const e = err as ApiError;
      setError('email', { message: e.message });
      toast.error(e.message);
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-in-up">
        <div className="mb-7 inline-grid h-14 w-14 place-items-center rounded-full border border-accent/40 bg-accent/10 text-accent">
          <Check size={26} />
        </div>
        <AuthHeader
          title={
            <>
              Check your{' '}
              <em className="text-accent" style={{ fontStyle: 'italic' }}>
                inbox.
              </em>
            </>
          }
          lead={`If an account exists for ${sent}, we just sent a 6-digit code. The code expires in 10 minutes.`}
        />

        <Button
          onClick={() =>
            router.push(
              `/verify-otp?email=${encodeURIComponent(sent)}&intent=reset`,
            )
          }
          variant="primary"
          size="lg"
          iconRight={<ArrowRight size={14} />}
          fullWidth
        >
          Enter the code
        </Button>

        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-5 block w-full text-center font-mono text-2xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-paper"
        >
          Use a different email
        </button>
      </div>
    );
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
            Forgot your{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              password?
            </em>
          </>
        }
        lead="Tell us your email. We'll send you a 6-digit code to reset it."
      />

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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          iconRight={<ArrowRight size={14} />}
          fullWidth
          className="mt-3"
        >
          Send reset code
        </Button>
      </form>

      <p className="mt-7 text-center text-xs text-muted">
        Remembered it?{' '}
        <Link href="/signin" className="text-accent transition-opacity hover:opacity-80">
          Sign in
        </Link>
      </p>
    </>
  );
}
