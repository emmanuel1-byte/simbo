'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { ArrowRight, Check, ChevronDown, Database, Mic, Plus } from '@/components/icons';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';
import type { DbConnection } from '@/types';
import { useVoiceInput } from '@/lib/hooks/use-voice-input';

interface AskBoxProps {
  connection?: DbConnection | null;
  /** Full list of connections for the inline selector */
  connections?: DbConnection[];
  onConnectionSelect?: (c: DbConnection) => void;
  /** Opens the "add new connection" modal */
  onAddConnection?: () => void;
  onSubmit: (prompt: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  initialValue?: string;
  disabled?: boolean;
}

export function AskBox({
  connection,
  connections = [],
  onConnectionSelect,
  onAddConnection,
  onSubmit,
  placeholder = 'Ask anything about your data…',
  autoFocus,
  size = 'lg',
  initialValue = '',
  disabled,
}: AskBoxProps) {
  const [value, setValue]       = useState(initialValue);
  const [showConnMenu, setShowConnMenu] = useState(false);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const connMenuRef             = useRef<HTMLDivElement>(null);
  const voice                   = useVoiceInput({ onTranscript: (t) => setValue(t) });

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  // Close connection menu on outside click
  useEffect(() => {
    if (!showConnMenu) return;
    function onDown(e: MouseEvent) {
      if (connMenuRef.current && !connMenuRef.current.contains(e.target as Node)) {
        setShowConnMenu(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showConnMenu]);

  function grow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    if (voice.isListening) voice.stop();
    onSubmit(trimmed);
    setValue('');
    voice.reset();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  function handleVoiceClick() {
    if (!voice.isSupported) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    if (voice.status === 'denied') {
      toast.error('Microphone access denied. Enable it in browser settings.');
      return;
    }
    if (voice.isListening) {
      voice.stop();
      return;
    }
    voice.start();
  }

  function handleConnectionBadgeClick() {
    if (connections.length > 0) {
      setShowConnMenu((v) => !v);
    } else {
      onAddConnection?.();
    }
  }

  const isListening = voice.isListening;

  return (
    <form
      onSubmit={submit}
      className={cn(
        'ask-glow relative w-full overflow-visible rounded-lg border bg-ink-3 transition-colors duration-150',
        isListening ? 'border-accent' : 'border-rule-2',
      )}
    >
      {/* Input area */}
      <div className="flex items-start gap-3 px-4 pb-3 pt-4">
        <span
          className={cn(
            'mt-[3px] shrink-0 select-none font-mono text-[15px] leading-none transition-colors',
            isListening ? 'text-accent' : 'text-paper-3',
          )}
        >
          ›
        </span>

        <textarea
          ref={textareaRef}
          autoFocus={autoFocus}
          value={value}
          rows={1}
          onChange={(e) => { setValue(e.target.value); grow(); }}
          onKeyDown={handleKey}
          placeholder={isListening ? 'Listening…' : placeholder}
          disabled={disabled}
          className={cn(
            'w-full resize-none bg-transparent text-paper outline-none placeholder:text-paper-3',
            size === 'lg' ? 'text-[16px] leading-relaxed' : 'text-[14px] leading-relaxed',
            'max-h-[200px]',
            isListening && 'placeholder:text-accent/50',
          )}
          style={{ height: 'auto' }}
        />

        {isListening && <VoiceWave />}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 border-t border-rule px-3 py-2.5">

        {/* Connection selector */}
        <div ref={connMenuRef} className="relative">
          <button
            type="button"
            onClick={handleConnectionBadgeClick}
            className="flex items-center gap-1.5 rounded-sm border border-rule bg-ink-4 px-2 py-1 font-mono text-[10px] text-paper-2 transition-colors hover:border-rule-2 hover:text-paper"
          >
            <Database size={9} className="text-accent/70" />
            <span className="max-w-[120px] truncate">
              {connection?.name ?? 'no connection'}
            </span>
            <ChevronDown
              size={8}
              className={cn('text-paper-3 transition-transform', showConnMenu && 'rotate-180')}
            />
          </button>

          {/* Dropdown */}
          {showConnMenu && (
            <div className="absolute bottom-full left-0 z-50 mb-2 min-w-[200px] overflow-hidden rounded-md border border-rule-2 bg-ink-3 shadow-floating">
              {connections.length > 0 && (
                <div className="border-b border-rule px-3 pb-1 pt-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-3">
                    Databases
                  </p>
                </div>
              )}
              {connections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onConnectionSelect?.(c);
                    setShowConnMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-4"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      c.status === 'connected' ? 'bg-ok' : 'bg-paper-3',
                    )}
                  />
                  <span className="flex-1 truncate font-mono text-[12px] text-paper-2">
                    {c.name}
                  </span>
                  {connection?.id === c.id && (
                    <Check size={10} className="flex-shrink-0 text-accent" />
                  )}
                </button>
              ))}
              {onAddConnection && (
                <button
                  type="button"
                  onClick={() => { setShowConnMenu(false); onAddConnection(); }}
                  className="flex w-full items-center gap-2 border-t border-rule px-3 py-2.5 text-left transition-colors hover:bg-ink-4"
                >
                  <Plus size={10} className="text-accent/70" />
                  <span className="font-mono text-[11px] text-paper-2">Add connection</span>
                </button>
              )}
            </div>
          )}
        </div>

        <span className="flex-1" />

        {/* Voice */}
        <button
          type="button"
          onClick={handleVoiceClick}
          title={isListening ? 'Stop listening (click)' : 'Voice input'}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-sm border transition-colors',
            isListening
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-rule text-paper-3 hover:border-rule-2 hover:text-paper',
          )}
        >
          <Mic size={13} />
        </button>

        {/* Submit */}
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 font-mono text-[11px] font-medium text-paper-inv transition-all hover:bg-accent-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {disabled ? (
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          ) : (
            <>Ask <ArrowRight size={11} /></>
          )}
        </button>

      </div>
    </form>
  );
}

function VoiceWave() {
  return (
    <div className="mt-1 flex h-5 flex-shrink-0 items-end gap-[3px]" aria-hidden>
      {[0.55, 0.9, 0.5, 1, 0.65, 0.4, 0.8].map((h, i) => (
        <span
          key={i}
          className="block w-[2px] rounded-full bg-accent"
          style={{
            height: `${h * 100}%`,
            animation: `voiceBar 0.85s ease-in-out ${i * 0.08}s infinite alternate`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes voiceBar {
          0%   { transform: scaleY(0.25); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
