import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AiStatus } from '@/types';

// Is the hub's local AI running, are its models downloaded, can it see pictures? Rechecked every 15 seconds.
export const useAiStatus = () =>
  useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<AiStatus>('/ai/status'),
    refetchInterval: 15_000,
  });

// Reads text aloud with the device's own voices (they work offline). One message at a time.
export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  useEffect(() => () => void (supported && speechSynthesis.cancel()), [supported]);

  const toggle = (id: number, text: string) => {
    if (!supported) return;
    speechSynthesis.cancel();
    if (speakingId === id) return setSpeakingId(null);
    const utterance = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, '').replace(/[*#_`>]/g, ''));
    const local = speechSynthesis.getVoices().filter((v) => v.localService);
    utterance.voice = local.find((v) => v.lang.startsWith(navigator.language.slice(0, 2))) ?? local[0] ?? null;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    speechSynthesis.speak(utterance);
  };

  return { supported, speakingId, toggle };
}
