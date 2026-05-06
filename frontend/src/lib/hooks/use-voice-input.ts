'use client';

/**
 * Voice input via the Web Speech API (browser-native, no SDK).
 *
 * Browser support:
 *   - Chrome / Edge / Safari (modern): full
 *   - Firefox: limited (behind a flag in many builds)
 *   - We feature-detect and expose `isSupported` to callers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Web Speech API typings (not in lib.dom by default) ──────
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror:
    | ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void)
    | null;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type VoiceStatus = 'idle' | 'listening' | 'denied' | 'unsupported' | 'error';

interface UseVoiceInputOptions {
  /** Called whenever the transcript updates (interim or final). */
  onTranscript?: (text: string, isFinal: boolean) => void;
  lang?: string;
}

interface UseVoiceInputReturn {
  isSupported: boolean;
  status: VoiceStatus;
  transcript: string;
  /** True while the user is holding/listening. */
  isListening: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  reset: () => void;
}

export function useVoiceInput({
  onTranscript,
  lang = 'en-US',
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalRef = useRef('');
  const onTranscriptRef = useRef(onTranscript);

  // Keep callback ref fresh without re-creating the recognition instance.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const SR =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;
  const isSupported = !!SR;

  // Instantiate once
  useEffect(() => {
    if (!SR) {
      setStatus('unsupported');
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onstart = () => setStatus('listening');
    rec.onend = () => setStatus((s) => (s === 'listening' ? 'idle' : s));
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setStatus('denied');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setStatus('error');
      }
    };
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalRef.current = (finalRef.current + ' ' + text).trim();
        } else {
          interim += text;
        }
      }
      const full = (finalRef.current + ' ' + interim).trim();
      setTranscript(full);
      onTranscriptRef.current?.(full, !interim);
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      rec.onstart = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [SR, lang]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    finalRef.current = '';
    setTranscript('');
    try {
      rec.start();
    } catch {
      // start() throws if already running — ignore
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (status === 'listening') stop();
    else start();
  }, [status, start, stop]);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
  }, []);

  return {
    isSupported,
    status,
    transcript,
    isListening: status === 'listening',
    start,
    stop,
    toggle,
    reset,
  };
}
