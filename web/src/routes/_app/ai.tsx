import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChat } from '@/hooks/useAi';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_app/ai')({ component: AiChatPage });

function AiChatPage() {
  const { messages, send, pending, reset } = useChat();
  const [input, setInput] = useState('');
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const submit = () => {
    if (!input.trim() || pending) return;
    send(input.trim());
    setInput('');
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Chat</h1>
        <Button variant="ghost" size="sm" onClick={reset} disabled={pending || !messages.length}>
          <RotateCcw /> New chat
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-4">
        {!messages.length && (
          <p className="text-center text-sm text-muted-foreground">Ask anything to start.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'w-fit max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
              m.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted',
            )}
          >
            {m.content || '…'}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          className="min-h-10 flex-1 resize-none"
          rows={1}
          placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button type="submit" disabled={pending || !input.trim()}>
          <Send /> Send
        </Button>
      </form>
    </div>
  );
}
