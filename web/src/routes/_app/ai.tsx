import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ImagePlus, List, Plus, Send, Square, Trash2, Volume2, X } from 'lucide-react';
import { AiStatus } from '@/components/AiStatus';
import { Markdown } from '@/components/Markdown';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAiStatus, useSpeech } from '@/hooks/useAi';
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useResolveAction,
  useSendMessage,
  useUpdateConversation,
} from '@/hooks/useConversations';
import { imageToBase64 } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ConversationMessage } from '@/types';

// Saved AI chats. ?c=<id> picks the conversation; without it the latest one opens.
export const Route = createFileRoute('/_app/ai')({
  validateSearch: (search: Record<string, unknown>): { c?: number } =>
    search.c ? { c: Number(search.c) } : {},
  component: AiChatPage,
});

function AiChatPage() {
  const { c } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: list } = useConversations();
  const activeId = c ?? list?.[0]?.id;
  const select = (id?: number) => navigate({ search: id ? { c: id } : {} });

  return (
    <div className="grid h-[calc(100vh-10rem)] gap-4 md:grid-cols-[15rem_1fr]">
      <aside className="hidden min-h-0 flex-col gap-2 md:flex">
        <ConversationList activeId={activeId} onSelect={select} />
      </aside>
      <ChatPanel conversationId={activeId} onSelect={select} />
    </div>
  );
}

function ConversationList({ activeId, onSelect }: { activeId?: number; onSelect: (id?: number) => void }) {
  const { data: list } = useConversations();
  const create = useCreateConversation();
  const remove = useDeleteConversation();

  return (
    <>
      <Button onClick={() => create.mutate({}, { onSuccess: (c) => onSelect(c.id) })}>
        <Plus /> New chat
      </Button>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {list?.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
              c.id === activeId && 'bg-muted font-medium',
            )}
          >
            <button className="flex-1 truncate text-left" onClick={() => onSelect(c.id)}>
              {c.title}
            </button>
            <button
              aria-label="Delete chat"
              className="text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={() => remove.mutate(c.id, { onSuccess: () => c.id === activeId && onSelect() })}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function ChatPanel({ conversationId, onSelect }: { conversationId?: number; onSelect: (id?: number) => void }) {
  const { data: conversation } = useConversation(conversationId);
  const { data: list } = useConversations();
  const { data: status } = useAiStatus();
  const create = useCreateConversation();
  const update = useUpdateConversation();
  const send = useSendMessage();
  const resolve = useResolveAction(conversation?.id);
  const speech = useSpeech();
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  // Settings for a chat that doesn't exist yet (it's created on the first message).
  const [newChat, setNewChat] = useState({ useDocs: false, useTools: false });
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), [conversation?.messages]);

  const settings = conversation ?? newChat;
  const setSetting = (key: 'useDocs' | 'useTools', on: boolean) =>
    conversation ? update.mutate({ id: conversation.id, [key]: on }) : setNewChat({ ...newChat, [key]: on });

  const submit = async () => {
    const content = input.trim();
    if (!content || send.isPending) return;
    let id = conversation?.id;
    if (!id) {
      id = (await create.mutateAsync(newChat)).id;
      onSelect(id);
    }
    send.mutate({ id, content, image: image ?? undefined });
    setInput('');
    setImage(null);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="truncate text-2xl font-bold">{conversation?.title ?? 'AI Chat'}</h1>
          <AiStatus />
        </div>
        <div className="flex items-center gap-3">
          <Label className="font-normal">
            <Checkbox checked={settings.useDocs} onCheckedChange={(on) => setSetting('useDocs', on === true)} />
            Use my documents
          </Label>
          {status?.tools && (
            <Label className="font-normal" title="The AI can look things up and propose changes; you confirm each change.">
              <Checkbox checked={settings.useTools} onCheckedChange={(on) => setSetting('useTools', on === true)} />
              Allow app actions
            </Label>
          )}
          {/* Small screens: the chat list lives in a menu. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Chats">
                <List />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSelect()}>
                <Plus /> New chat
              </DropdownMenuItem>
              {list?.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => onSelect(c.id)}>
                  {c.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border p-4">
        {!conversation?.messages.length && (
          <p className="text-center text-sm text-muted-foreground">
            Ask anything to start.{settings.useDocs ? ' Answers will use your documents.' : ''}
          </p>
        )}
        {conversation?.messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            speaking={speech.speakingId === m.id}
            onSpeak={speech.supported ? () => speech.toggle(m.id, m.content) : undefined}
            onResolve={(approve) => resolve.mutate({ messageId: m.id, approve })}
            resolving={resolve.isPending}
          />
        ))}
        <div ref={bottom} />
      </div>

      {image && (
        <div className="flex items-center gap-2">
          <img src={`data:image/jpeg;base64,${image}`} alt="" className="h-16 rounded-md border" />
          <Button variant="ghost" size="icon" aria-label="Remove picture" onClick={() => setImage(null)}>
            <X />
          </Button>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {status?.vision && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setImage(await imageToBase64(file));
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add a picture"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus />
            </Button>
          </>
        )}
        <Textarea
          className="min-h-10 flex-1 resize-none"
          rows={1}
          placeholder={image ? 'Ask about the picture…' : 'Type a message… (Enter to send, Shift+Enter for a new line)'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {send.isPending ? (
          <Button type="button" variant="outline" onClick={send.stop}>
            <Square /> Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <Send /> Send
          </Button>
        )}
      </form>
    </div>
  );
}

function MessageBubble(props: {
  message: ConversationMessage;
  speaking: boolean;
  onSpeak?: () => void;
  onResolve: (approve: boolean) => void;
  resolving: boolean;
}) {
  const { message: m } = props;
  const mine = m.role === 'user';

  return (
    <div className={cn('flex w-fit max-w-[85%] flex-col gap-2', mine && 'ml-auto items-end')}>
      {m.image && <img src={`data:image/jpeg;base64,${m.image}`} alt="" className="max-h-48 rounded-md border" />}
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm',
          mine ? 'whitespace-pre-wrap bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        {mine || !m.content ? m.content || '…' : <Markdown>{m.content}</Markdown>}
      </div>
      {!mine && !!m.sources?.length && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {m.sources.map((s) => (
            <p key={s.n}>
              [{s.n}] {s.title}
              {s.page ? ` · page ${s.page}` : ''}
            </p>
          ))}
        </div>
      )}
      {m.action && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">{m.action.description}</p>
          {m.action.status === 'pending' && m.id > 0 ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={props.resolving} onClick={() => props.onResolve(true)}>
                Confirm
              </Button>
              <Button size="sm" variant="outline" disabled={props.resolving} onClick={() => props.onResolve(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {m.action.status === 'done' ? 'Done' : m.action.status === 'cancelled' ? 'Cancelled' : 'Waiting…'}
            </p>
          )}
        </div>
      )}
      {!mine && m.content && props.onSpeak && (
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={props.onSpeak}>
          {props.speaking ? <Square /> : <Volume2 />} {props.speaking ? 'Stop' : 'Read aloud'}
        </Button>
      )}
    </div>
  );
}
