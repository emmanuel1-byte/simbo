'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppTopbar } from '@/components/app/app-topbar';
import { AskBox } from '@/components/app/ask-box';
import { SuggestedPrompts } from '@/components/app/suggested-prompts';
import { AddConnectionModal } from '@/components/app/add-connection-modal';
import { Pill } from '@/components/ui/pill';
import { Button } from '@/components/ui/button';
import { ArrowRight, Database, Key } from '@/components/icons';
import { useConnections } from '@/lib/hooks/use-connections';
import { useAuth } from '@/contexts/auth-context';
import { useOnboardingState } from '@/lib/hooks/use-onboarding-state';

export default function AskPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selected: connection, loading: connectionsLoading, refresh } = useConnections();
  const onboarding = useOnboardingState();
  const [seed, setSeed] = useState<string>('');
  const [showAddConn, setShowAddConn] = useState(false);

  async function handleSubmit(prompt: string) {
    if (!connection) return;
    const conversationId = 'new_' + Date.now();
    router.push(
      `/chat/${conversationId}?prompt=${encodeURIComponent(prompt)}&connection=${connection.id}`,
    );
  }

  const showOnboarding = onboarding === 'needs_api_key' || onboarding === 'needs_connection';

  return (
    <>
      <AppTopbar crumb={<span>workspace · acme analytics</span>} />

      {/* Onboarding banner */}
      {showOnboarding && (
        <div className="border-b border-rule bg-ink-2 px-6 py-4 animate-fade-in lg:px-8">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-4">
            <div
              className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-accent/10 text-accent"
              style={{ boxShadow: '0 0 16px rgba(211,255,58,0.15)' }}
            >
              {onboarding === 'needs_api_key' ? <Key size={18} /> : <Database size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <b className="block font-mono text-[12px] uppercase tracking-[0.16em] text-accent">
                {onboarding === 'needs_api_key' ? 'step 01 of 02' : 'step 02 of 02'}
              </b>
              <span className="font-serif text-[18px] font-light text-paper">
                {onboarding === 'needs_api_key' ? (
                  <>
                    Add your AI provider key to{' '}
                    <em className="italic text-accent">power</em> Simbo.
                  </>
                ) : (
                  <>
                    Connect a database to{' '}
                    <em className="italic text-accent">start</em> querying.
                  </>
                )}
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              iconRight={<ArrowRight size={14} />}
              onClick={() => {
                if (onboarding === 'needs_api_key') {
                  router.push('/settings/api-key');
                } else {
                  setShowAddConn(true);
                }
              }}
            >
              {onboarding === 'needs_api_key' ? 'Add API key' : 'Add connection'}
            </Button>
          </div>
        </div>
      )}

      {/* Hero stage */}
      <main
        className="grid flex-1 place-items-center px-6 py-10 lg:px-8 lg:py-12"
        style={{
          backgroundImage:
            'radial-gradient(700px 360px at 50% 30%, rgba(211,255,58,0.06), transparent 70%)',
        }}
      >
        <div className="flex w-full flex-col items-center text-center animate-fade-in-up">
          <div className="label-eyebrow mb-5 flex items-center gap-2.5">
            <span className="h-px w-7 bg-rule" />
            ask anything · read-only
            <span className="h-px w-7 bg-rule" />
          </div>

          <h1 className="m-0 mb-3.5 max-w-[900px] font-serif text-4xl font-light leading-[1] tracking-[-0.03em] text-paper md:text-5xl lg:text-[64px]">
            Talk to your database{' '}
            <em className="text-accent" style={{ fontStyle: 'italic' }}>
              like a person.
            </em>
          </h1>
          <p className="mx-auto mb-9 max-w-[520px] text-[15px] text-muted">
            {user?.name ? `${user.name}, type` : 'Type'} a question, or hold to speak. Simbo
            translates it into safe SQL, runs it, and shows you exactly what happened.
          </p>

          <AskBox
            connection={connection}
            onSubmit={handleSubmit}
            autoFocus
            initialValue={seed}
            disabled={connectionsLoading || !connection}
            onConnectionClick={() => router.push('/settings/connections')}
          />

          <div className="mt-9 w-full max-w-[720px]">
            <SuggestedPrompts onPick={(p) => setSeed(p)} />
          </div>
        </div>
      </main>

      <footer className="hidden items-center justify-between border-t border-rule px-8 py-3.5 font-mono text-[11px] text-muted lg:flex">
        <div>
          {connection
            ? `${connection.name} · ${connection.tablesCount ?? 0} tables`
            : 'no connection'}
        </div>
        <div className="flex gap-2">
          <Pill variant="safe">SAFE MODE ON</Pill>
          <Pill variant="muted">v0.4.2</Pill>
        </div>
      </footer>

      <AddConnectionModal
        open={showAddConn}
        onClose={() => setShowAddConn(false)}
        onCreated={() => refresh()}
      />
    </>
  );
}
