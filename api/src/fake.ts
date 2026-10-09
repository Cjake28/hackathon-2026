// FAKE DATA for the H0 stubs (TEAM-PLAN.md). Every stub endpoint returns these, in the final JSON shape (4.4),
// so the UI and the other devs can build before the real code exists.
// Owners: when your endpoint is real, stop importing from here. Delete this file when nothing imports it.

const now = Date.now();
const iso = (minutesFromNow: number) => new Date(now + minutesFromNow * 60_000).toISOString();

export const FAKE_PEOPLE = [
  { id: 2, name: 'Mom', role: 'parent', isHome: true, lastSeenAt: iso(0) },
  { id: 3, name: 'Dad', role: 'parent', isHome: false, lastSeenAt: iso(-180) },
  { id: 4, name: 'Ana', role: 'child', isHome: true, lastSeenAt: iso(0) },
  { id: 5, name: 'Ben', role: 'child', isHome: false, lastSeenAt: null },
];

export const FAKE_ALARMS = [
  {
    id: 1, userId: 4, createdById: 2, kind: 'alarm', label: 'Wake up', time: '06:30', repeat: 'weekdays',
    nextAt: iso(600), enabled: true, ringingAt: null,
  },
  {
    id: 2, userId: 2, createdById: 2, kind: 'reminder', label: 'Take medicine', time: '20:00', repeat: 'daily',
    nextAt: iso(300), enabled: true, ringingAt: null,
  },
];

export const FAKE_RINGING_ALARM = { ...FAKE_ALARMS[0], ringingAt: iso(0) };

export const FAKE_TASKS = [
  {
    id: 1, title: 'Wash the dishes', assigneeId: 4, assigneeName: 'Ana', createdById: 2, isChore: true,
    checklist: ['sink is empty', 'dishes are in the rack'], dueAt: iso(120), status: 'pending',
    beforePhoto: null, afterPhoto: null, feedback: null, createdAt: iso(-30), doneAt: null,
  },
  {
    id: 2, title: 'Finish math homework', assigneeId: 4, assigneeName: 'Ana', createdById: 3, isChore: false,
    checklist: [], dueAt: null, status: 'done', beforePhoto: null, afterPhoto: null, feedback: null,
    createdAt: iso(-90), doneAt: iso(-10),
  },
];

export const FAKE_NOTICES = [
  { id: 1, toUserId: 4, kind: 'task:new', text: 'Mom: Wash the dishes', data: { taskId: 1 }, createdAt: iso(-1) },
  {
    id: 2, toUserId: null, kind: 'voice:heard', text: 'Mom: wake Ana up at 6:30',
    data: { speaker: 'Mom', confidence: 0.91, reply: "Set a wake-up alarm for Ana at 6:30 AM? Say yes." },
    createdAt: iso(-1),
  },
];

export const FAKE_MEMORY = [
  { id: 1, userId: 4, text: 'likes adobo', createdAt: iso(-2000) },
  { id: 2, userId: 4, text: 'has piano every Saturday at 4 PM', createdAt: iso(-1500) },
];

export const FAKE_EVENTS = [
  { id: 1, title: 'Ana piano lesson', startsAt: iso(240), userId: 4, createdById: 2 },
  { id: 2, title: "Family dinner at Lola's", startsAt: iso(1800), userId: null, createdById: 3 },
];

export const FAKE_EXPENSES = [
  { id: 1, amount: 1250, category: 'food', note: 'Groceries', addedById: 2, spentAt: iso(-1440) },
  { id: 2, amount: 3400, category: 'bills', note: 'Electricity', addedById: 3, spentAt: iso(-4320) },
];

export const FAKE_BUDGET = { month: '2026-10', total: 4650, limit: 20000, byCategory: { food: 1250, bills: 3400 } };

export const FAKE_BRIEFING =
  'Good morning Ana! You have piano at 4 PM and one chore left: wash the dishes. Adobo is on the grocery list.';
