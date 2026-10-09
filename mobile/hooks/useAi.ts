import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Speech from 'expo-speech';
import { api } from '@/lib/api';
import type { AiStatus } from '@/types';

// Is the hub's local AI running, are its models downloaded, can it see pictures? Rechecked every 15 seconds.
export const useAiStatus = () =>
  useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<AiStatus>('/ai/status'),
    refetchInterval: 15_000,
  });

// Reads text aloud with the phone's own voice (works offline). One message at a time.
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  useEffect(() => () => void Speech.stop(), []);

  const toggle = (id: number, text: string) => {
    Speech.stop();
    if (speakingId === id) return setSpeakingId(null);
    setSpeakingId(id);
    Speech.speak(text.replace(/\[\d+\]/g, '').replace(/[*#_`>]/g, ''), {
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  return { speakingId, toggle };
}
