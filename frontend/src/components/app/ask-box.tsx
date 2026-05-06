'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRight, ChevronDown, Database, MessageSquare, Mic } from '@/components/icons';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';
import type { DbConnection } from '@/types';
import { useVoiceInput } from '@/lib/hooks/use-voice-input';

interface AskBoxProps {
  connection?: DbConnection | null;
  onSubmit: (prompt: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  initialValue?: string;
  disabled?: boolean;
  /** Optional click handler on the connection chip — for opening a picker */
  onConnectionClick?: () => void;
}

export function AskBox({
  connection,
  onSubmit,
  placeholder = 'How many active users signed up last week vs the week before?',
  autoFocus,
  size = 'lg',
  initialValue = '',
  disabled,
  onConnectionClick,
}: AskBoxProps) {
  const [value, setValue] = useState(initialValue);
  const [mode, setMode] = useState<'text' | 'voice'>('text');

  // Pull voice input — feed transcripts into the value as they come in.
  const voice = useVoiceInput({
    onTranscript: (text) => setValue(text),
  });

  // Keep value in sync if `initialValue` changes (e.g. after a suggested-prompt click).
  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (voice.isListening) voice.stop();
    onSubmit(trimmed);
    setValue('');
    voice.reset();
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handleVoiceClick() {
    if (!voice.isSupported) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Safari.");
      return;
    }
    if (voice.status === 'denied') {
      toast.error('Microphone access was denied. Enable it in your browser settings.');
      return;
    }
    setMode('voice');
    voice.toggle();
  }

  const isListening = voice.isListening;

  return (
    <form
      onSubmit={submit}
      className={cn(
        'w-full max-w-[720px] rounded-[14px] border bg-ink-2 p-1.5 transition-colors',
        isListening
          ? 'border-accent shadow-[0_0_0_4px_rgba(211,255,58,0.12)]'
          : 'border-rule-2',
        size === 'lg' &&
          !isListening &&
          'shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_0_4px_rgba(211,255,58,0.04)]',
      )}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2.5">
        {/* Mode toggle */}
        <div className="flex overflow-hidden rounded-lg border border-rule">
          <button
            type="button"
            onClick={() => {
              setMode('text');
              if (isListening) voice.stop();
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] transition-colors',
              mode === 'text' ? 'bg-ink-4 text-paper' : 'text-muted',
            )}
          >
            <MessageSquare size={14} />
            Text
          </button>
          <button
            type="button"
            onClick={handleVoiceClick}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] transition-colors',
              mode === 'voice' && isListening
                ? 'bg-accent text-ink animate-pulse-accent'
                : mode === 'voice'
                  ? 'bg-ink-4 text-paper'
                  : 'text-muted',
            )}
          >
            <Mic size={14} />
            {isListening ? 'Listening' : 'Voice'}
          </button>
        </div>

        <input
          type="text"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={isListening ? 'Speak now…' : placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 bg-transparent text-paper outline-none placeholder:text-muted-2',
            size === 'lg' ? 'py-3.5 text-[18px]' : 'py-2.5 text-[15px]',
            isListening && 'placeholder:text-accent',
          )}
        />

        {isListening && <VoiceWave />}
      </div>

      <div className="flex items-center gap-2.5 border-t border-rule px-3.5 py-2.5">
        <button
          type="button"
          onClick={onConnectionClick}
          className="flex items-center gap-2 rounded-md border border-rule px-2.5 py-1.5 font-mono text-[11px] text-paper transition-colors hover:border-paper"
        >
          <Database size={12} />
          {connection?.name ?? 'no connection'}
          <ChevronDown size={12} className="ml-1 opacity-60" />
        </button>
        <span className="hidden font-mono text-2xs uppercase tracking-[0.12em] text-muted sm:inline">
          ⌘K shortcuts
        </span>

        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="ml-auto flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 font-mono text-[11px] font-medium text-ink transition-all hover:bg-accent-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run query
          <ArrowRight size={12} />
        </button>
      </div>
    </form>
  );
}

/** Tiny animated bar visualizer shown while listening. */
function VoiceWave() {
  return (
    <div className="flex h-7 items-end gap-[3px]" aria-hidden="true">
      {[0.6, 0.9, 0.5, 1, 0.7, 0.4, 0.85].map((h, i) => (
        <span
          key={i}
          className="block w-[2.5px] rounded-full bg-accent"
          style={{
            height: `${h * 100}%`,
            animation: `voiceBar 0.9s ease-in-out ${i * 0.07}s infinite alternate`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes voiceBar {
          0% {
            transform: scaleY(0.4);
          }
          100% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
