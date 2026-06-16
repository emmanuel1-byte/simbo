'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/components/ui/otp-input';
import { AuthHeader } from '@/components/auth/auth-header';
import { ArrowLeft, ArrowRight, Mail } from '@/components/icons';
import { authApi } from '@/lib/api';
import type { ApiError } from '@/types';

function VerifyOtpInner() {
  const router = useRouter();
  const search = useSearchParams();
  const email = search.get('email') ?? '';
  const intent = search.get('intent') ?? 'verify'; // 'verify' or 'reset'

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // No email? Punt back to signup.
  useEffect(() => {
    if (!email) router.replace('/signup');
  }, [email, router]);

  async function handleSubmit() {
    if (code.length < 6) {
      setError('Enter all 6 digits.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (intent === 'reset') {
        // Bounce to reset-password page carrying the code
        router.push(
          `/reset-password?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`,
        );
        return;
      }
      await authApi.verifyOtp(email, code);
      toast.success('Email verified. Sign in to continue.');
      router.replace('/signin?next=/onboarding');
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    try {
      await authApi.requestOtp(email);
      setCooldown(60);
      toast.success('New code sent. Check your inbox.');
    } catch (err) {
      toast.error((err as ApiError).message);
    }
  }

  return (
    <>
      <Link
        href={intent === 'reset' ? '/forgot-password' : '/signup'}
        className="mb-8 inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.18em] text-muted transition-colors hover:text-paper"
      >
        <ArrowLeft size={12} /> back
      </Link>

      <AuthHeader
        eyebrow="step 02 / 02"
        title={
          <>
            Enter the{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              code we sent you.
            </em>
          </>
        }
        lead={`We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
      />

      <div className="mb-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
        <Mail size={12} /> verification code
      </div>

      <OtpInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(null);
          if (v.length === 6) {
            // Auto-submit when all digits entered
            setTimeout(handleSubmit, 100);
          }
        }}
        invalid={!!error}
        autoFocus
      />

      {error && (
        <p className="mt-3 font-mono text-2xs uppercase tracking-[0.12em] text-warn animate-fade-in">
          {error}
        </p>
      )}

      <Button
        onClick={handleSubmit}
        variant="primary"
        size="lg"
        loading={submitting}
        iconRight={<ArrowRight size={14} />}
        fullWidth
        className="mt-7"
        disabled={code.length < 6}
      >
        {intent === 'reset' ? 'Continue' : 'Verify and continue'}
      </Button>

      <div className="mt-7 flex items-center justify-between">
        <span className="font-mono text-2xs uppercase tracking-[0.12em] text-muted">
          didn't receive it?
        </span>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="font-mono text-xs text-accent transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>

      {/* Demo helper — only visible when mocks are on */}
      {process.env.NEXT_PUBLIC_USE_MOCKS === 'true' && (
        <div className="mt-9 rounded-lg border border-dashed border-rule-2 bg-white/[0.015] p-4 font-mono text-2xs text-muted">
          <span className="text-accent">demo:</span> use code <b className="text-paper">123456</b>{' '}
          to verify.
        </div>
      )}
    </>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpInner />
    </Suspense>
  );
}
