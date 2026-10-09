import { useAiStatus } from '@/hooks/useAi';
import { cn } from '@/lib/utils';

// Small badge: is the hub's local AI ready?
export function AiStatus() {
  const { data } = useAiStatus();
  if (!data) return null;

  const [color, text] = !data.online
    ? ['bg-red-500', 'Local AI offline: start Ollama on the hub']
    : data.missing.length
      ? ['bg-amber-500', `Model not downloaded: ollama pull ${data.missing[0]}`]
      : ['bg-green-500', `Local AI · ${data.model}`];

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn('size-2 rounded-full', color)} />
      {text}
    </span>
  );
}
