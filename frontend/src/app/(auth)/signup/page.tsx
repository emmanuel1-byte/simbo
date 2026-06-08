'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { AuthHeader } from '@/components/auth/auth-header';
import { ArrowRight, Check, Mail, User as UserIcon } from '@/components/icons';
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
    defaultValues: { name: '', email: '', password: '' },
  });

  const password = watch('password');

  const passwordChecks = [
    { label: '8+ chars',  ok: (password ?? '').length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password ?? '') },
    { label: 'Lowercase', ok: /[a-z]/.test(password ?? '') },
    { label: 'Number',    ok: /\d/.test(password ?? '') },
  ];

  async function onSubmit(values: SignupValues) {
    try {
      await authApi.signup({ name: values.name, email: values.email, password: values.password });
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
            <em className="text-accent" style={{ fontStyle: 'italic' }}>workspace.</em>
          </>
        }
        lead="Sign up in 30 seconds. We'll send a code to verify your email."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <Field label="full name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Emmanuel"
            iconLeft={<UserIcon size={15} />}
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
            iconLeft={<Mail size={15} />}
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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {passwordChecks.map((c) => (
              <span
                key={c.label}
                className={cn(
                  'inline-flex items-center gap-1 rounded-xs border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-all duration-150',
                  c.ok
                    ? 'border-accent/40 bg-accent/8 text-accent'
                    : 'border-rule text-paper-3',
                )}
              >
                {c.ok && <Check size={9} />}
                {c.label}
              </span>
            ))}
          </div>
        </Field>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          iconRight={<ArrowRight size={14} />}
          fullWidth
          className="mt-2"
        >
          Create account
        </Button>
      </form>

      <p className="mt-7 text-center text-[13px] text-paper-2">
        Already have an account?{' '}
        <Link href="/signin" className="text-accent transition-opacity hover:opacity-75">
          Sign in
        </Link>
      </p>
    </>
  );
}
