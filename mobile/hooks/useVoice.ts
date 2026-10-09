import { create } from 'zustand';
import { GUEST, useFamilyStore } from '@/hooks/useFamily';
import { can } from '@/lib/family-permissions';
import type { Capability, FamilyMember, ListenState, Utterance } from '@/types';

export const WAKE_WORD = 'Hey Nova';

/** No language model here — a request is matched by keyword to an intent. */
interface Intent {
  id: string;
  match: readonly (readonly string[])[];
  needs: Capability;
  reply: string | ((name: string) => string);
}

const INTENTS: readonly Intent[] = [
  {
    id: 'assign-task',
    match: [['tell', 'to'], ['ask', 'to'], ['give', 'task'], ['assign']],
    needs: 'assignTasks',
    reply: "Done. I've sent it to their device and I'll say it out loud when they're next in the room.",
  },
  {
    id: 'chore-check',
    match: [['check', 'chore'], ['is', 'done'], ['did', 'finish']],
    needs: 'reviewChores',
    reply: "I compared the before and after. The sink is clear and the counters are wiped, but the bin hasn't gone out yet. Want me to send that back?",
  },
  {
    id: 'set-alarm-other',
    match: [['wake', 'up'], ['set', 'alarm', 'for']],
    needs: 'othersAlarms',
    reply: (name) => `Set. Only their voice can turn it off, and I'll tell ${name} if it's still going after ten minutes.`,
  },
  {
    id: 'set-alarm-own',
    match: [['alarm'], ['wake', 'me']],
    needs: 'ownAlarms',
    reply: "Set. I'll only take your voice to turn it off.",
  },
  {
    id: 'block',
    match: [['block'], ['turn', 'off', 'internet'], ['pause', 'internet']],
    needs: 'network',
    reply: 'Blocked on that device only. Everything else in the house is untouched.',
  },
  {
    id: 'where',
    match: [['where', 'is'], ['who', 'home'], ['anyone', 'home']],
    needs: 'location',
    reply: "Ana's in her room and Miguel's in the living room. Dante's still out — he left work about ten minutes ago.",
  },
  {
    id: 'lights',
    match: [['lights'], ['turn', 'on'], ['turn', 'off']],
    needs: 'smartHome',
    reply: 'Done.',
  },
  {
    id: 'camera',
    match: [['camera'], ['front', 'door'], ['doorbell']],
    needs: 'cameras',
    reply: 'Front door camera is up. Nobody there now — last was a delivery at 2:40 this afternoon.',
  },
  {
    id: 'time',
    match: [['time'], ['what', 'day'], ['weather']],
    needs: 'ask',
    reply: "It's just gone nine in the morning. Warm and overcast, rain likely this afternoon.",
  },
];

const NO_MATCH_REPLY = "I didn't catch an instruction in that. Try naming the person or the thing you want, and I'll do it.";

function refusalFor(name: string, role: string): string {
  if (role === 'guest') {
    return "I don't recognise your voice, so I can only answer the time and the weather. Ask someone in the family to enrol you.";
  }
  return `That's a parent thing, ${name}. Ask Rosa or Dante and I'll do it straight away.`;
}

export const SUGGESTED_COMMANDS: Record<string, readonly string[]> = {
  parent: [
    'Tell Miguel to put the bins out',
    'Check if Ana finished the washing up',
    'Wake Ana up at 6:15 tomorrow',
    "Block games on Miguel's tablet",
    'Where is Ana?',
  ],
  child: [
    'Set an alarm for 7 o’clock',
    "What's on my list today?",
    'Turn on the living room lights',
    "What's the weather?",
  ],
  guest: ['What time is it?', "What's the weather?"],
};

/** First intent whose keyword groups are all present in the request. */
function resolve(request: string): Intent | undefined {
  const text = request.toLowerCase();
  return INTENTS.find((intent) => intent.match.some((group) => group.every((word) => text.includes(word))));
}

const REPLY_SIMULATION = { thinkingMs: 650, chunkIntervalMs: 28, chunkSize: 3 };

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

interface VoiceState {
  transcript: Utterance[];
  listenState: ListenState;
  wakeWordActive: boolean;

  setListenState: (state: ListenState) => void;
  wake: () => void;
  sleep: () => void;
  ask: (request: string, speaker?: FamilyMember) => void;
  clear: () => void;
}

export const useVoiceStore = create<VoiceState>()((set, get) => {
  /** Types `reply` into the placeholder a few characters at a time. */
  const speak = (id: string, reply: string) => {
    let cursor = 0;

    const timer = setInterval(() => {
      cursor = Math.min(reply.length, cursor + REPLY_SIMULATION.chunkSize);
      const done = cursor >= reply.length;
      if (done) clearInterval(timer);

      set((state) => ({
        listenState: done ? 'idle' : 'speaking',
        wakeWordActive: done ? false : state.wakeWordActive,
        transcript: state.transcript.map((line) =>
          line.id === id ? { ...line, text: reply.slice(0, cursor), streaming: !done } : line
        ),
      }));
    }, REPLY_SIMULATION.chunkIntervalMs);
  };

  return {
    transcript: [],
    listenState: 'idle',
    wakeWordActive: false,

    setListenState: (listenState) => set({ listenState }),
    wake: () => set({ wakeWordActive: true, listenState: 'listening' }),
    sleep: () => set({ wakeWordActive: false, listenState: 'idle' }),

    ask: (request, speaker) => {
      const trimmed = request.trim();
      if (!trimmed) return;
      if (get().listenState === 'thinking' || get().listenState === 'speaking') return;

      const family = useFamilyStore.getState();
      const person = speaker ?? family.members.find((member) => member.id === family.speakerId) ?? GUEST;

      const now = new Date().toISOString();
      const intent = resolve(trimmed);
      const allowed = intent ? can(person.role, intent.needs) : true;

      const reply = !intent
        ? NO_MATCH_REPLY
        : !allowed
          ? refusalFor(person.name, person.role)
          : typeof intent.reply === 'function'
            ? intent.reply(person.name)
            : intent.reply;

      const replyId = nextId('hub');

      set((state) => ({
        listenState: 'thinking',
        wakeWordActive: true,
        transcript: [
          ...state.transcript,
          {
            id: nextId('person'),
            speaker: 'person',
            text: trimmed,
            personId: person.id === GUEST.id ? null : person.id,
            role: person.role,
            room: person.room,
            createdAt: now,
          },
          {
            id: replyId,
            speaker: 'hub',
            text: '',
            personId: person.id === GUEST.id ? null : person.id,
            role: person.role,
            room: person.room,
            createdAt: now,
            streaming: true,
            refused: Boolean(intent) && !allowed,
          },
        ],
      }));

      // Hold before the first words land — an instant reply reads as canned.
      setTimeout(() => speak(replyId, reply), REPLY_SIMULATION.thinkingMs);
    },

    clear: () => set({ transcript: [], listenState: 'idle' }),
  };
});
