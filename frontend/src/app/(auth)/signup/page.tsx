'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { Divider } from '@/components/ui/surface';
import { AuthHeader } from '@/components/auth/auth-header';
import { OAuthButton } from '@/components/auth/oauth-button';
import { ArrowRight, Mail, User as UserIcon, Check } from '@/components/icons';
import { signupSchema, type SignupValues } from '@/lib/validators/auth';
import { authApi } from '@/lib/api';
import type { ApiError } from '@/types';
import { cn } from '@/lib/utils/cn';

export default function SignupPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', acceptTerms: false as unknown as true },
  });

  const password = watch('password');
  const acceptTerms = watch('acceptTerms');

  const passwordChecks = [
    { label: '8+ characters', ok: (password ?? '').length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password ?? '') },
    { label: 'Lowercase', ok: /[a-z]/.test(password ?? '') },
    { label: 'Number', ok: /[0-9]/.test(password ?? '') },
  ];

  async function onSubmit(values: SignupValues) {
    try {
      await authApi.signup({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success('Check your inbox — we sent a 6-digit code.');
      router.push(`/verify-otp?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const e = err as ApiError;
      if (e.fieldErrors) {
        for (const [field, message] of Object.entries(e.fieldErrors)) {
          setError(field as keyof SignupValues, { message });
        }
      }
      toast.error(e.message);
    }
  }

  return (
    <>
      <AuthHeader
        title={
          <>
            Make a{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              workspace.
            </em>
          </>
        }
        lead="Sign up in 30 seconds. We'll send a code to verify your email."
      />

      <OAuthButton provider="google" label="Google" className="mb-5" />
      <Divider label="or with email" className="my-6" />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Field label="full name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Emmanuel"
            iconLeft={<UserIcon size={16} />}
            invalid={!!errors.name}
            {...register('name')}
          />
        </Field>

        <Field label="work email" htmlFor="email" error={errors.email?.message}>
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

        <Field label="password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            invalid={!!errors.password}
            {...register('password')}
          />
          {/* Password strength meter */}
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

        <label className="mt-2 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 cursor-pointer accent-accent"
            {...register('acceptTerms')}
          />
          <span className="text-xs text-muted">
            I accept Simbo's{' '}
            <span className="text-paper underline underline-offset-2">Terms</span> and{' '}
            <span className="text-paper underline underline-offset-2">Privacy Policy</span>.
          </span>
        </label>
        {errors.acceptTerms && (
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-warn -mt-1">
            {errors.acceptTerms.message as string}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          iconRight={<ArrowRight size={14} />}
          fullWidth
          className="mt-3"
          disabled={!acceptTerms}
        >
          Create account
        </Button>
      </form>

      <p className="mt-7 text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href="/signin" className="text-accent transition-opacity hover:opacity-80">
          Sign in
        </Link>
      </p>
    </>
  );
}
