import { BadRequestException } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { createSign, randomInt } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { PrismaService } from '../prisma.service';

// Google Calendar copy of the family calendar (an online extra: the hub works without it, and events are saved on the
// hub first). The hub has its own Google "robot" account, a service account. Each person shares their own Google
// Calendar with it ("Make changes to events") and connects it in the app. Sharing alone doesn't prove whose calendar
// it is (the whole family shares with the same robot), so connecting also needs a one-time code: the hub puts
// "Jarvis code: 482913" in that calendar, and only someone who can see the calendar can type it. One calendar = one
// owner. No OAuth, no passwords.
// A person's event → their calendar. A family event (userId null) → the Family calendar (Setting "google.familyCalendar").
// Setup: docs/google-calendar.md.

const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google-key.json'; // api/google-key.json is git-ignored
const API = process.env.GOOGLE_CALENDAR_API || 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';
const FAMILY_KEY = 'google.familyCalendar';
const RETRY_MS = 60_000; // an event that failed (offline, not shared any more) is tried again a minute later
const EVENT_MINUTES = 60; // hub events have no end time: 1 hour in Google
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

type ServiceAccount = { client_email: string; private_key: string; token_uri: string };
let account: ServiceAccount | null | undefined;
let token: { value: string; expires: number } | null = null;

class GoogleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function serviceAccount() {
  if (account === undefined) {
    try {
      account = existsSync(KEY_FILE) ? (JSON.parse(readFileSync(KEY_FILE, 'utf8')) as ServiceAccount) : null;
    } catch {
      account = null;
    }
  }
  return account;
}

export const googleEnabled = () => !!serviceAccount();
// The address people share their calendar with.
export const googleShareWith = () => serviceAccount()?.client_email ?? null;

// A service account logs in with a JWT it signs itself (RS256) instead of a user's consent.
async function accessToken() {
  const sa = serviceAccount();
  if (!sa) throw new GoogleError(0, 'Google Calendar is not set up on the hub');
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const now = Math.floor(Date.now() / 1000);
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new GoogleError(res.status, `Google login failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function google<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new GoogleError(res.status, `Google Calendar ${method} ${path}: ${res.status}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

const at = (calendarId: string, eventId?: string) =>
  `/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ''}`;
const gone = (error: unknown) => error instanceof GoogleError && (error.status === 404 || error.status === 410);

export async function familyCalendar(prisma: PrismaService) {
  return (await prisma.setting.findUnique({ where: { key: FAMILY_KEY } }))?.value ?? null;
}

// Before connecting a calendar: may the hub write to it? Also adds it to the hub's own calendar list.
// Throws the sentence the app shows.
export async function checkCalendar(calendarId: string) {
  if (!googleEnabled()) throw new BadRequestException('Google Calendar is not set up on the hub (no service account key).');
  const share = `Share that calendar with ${googleShareWith()} ("Make changes to events") first.`;
  try {
    const entry = await google<{ accessRole: string }>('POST', '/users/me/calendarList', { id: calendarId }).catch((error) =>
      error instanceof GoogleError && error.status === 409
        ? google<{ accessRole: string }>('GET', `/users/me/calendarList/${encodeURIComponent(calendarId)}`)
        : Promise.reject(error),
    );
    if (!['writer', 'owner'].includes(entry.accessRole)) {
      throw new BadRequestException(`Jarvis can only see that calendar. ${share}`);
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    if (error instanceof GoogleError && [403, 404].includes(error.status)) throw new BadRequestException(share);
    throw new BadRequestException("Couldn't reach Google. Is the hub online?");
  }
}

// ---- Proving the calendar is yours: a one-time code inside it ----

const CHALLENGE_MS = 10 * 60_000; // the code works for 10 minutes
const CHALLENGE_TRIES = 5;
type Challenge = { calendarId: string; code: string; googleEventId: string; expires: number; tries: number };
const challenges = new Map<number, Challenge>(); // user id → the calendar waiting for its code

// Puts "Jarvis code: 482913" in the calendar (today, now). Only someone who can see that calendar can read it.
export async function startChallenge(userId: number, calendarId: string) {
  await dropChallenge(userId);
  const code = String(randomInt(100_000, 1_000_000));
  const start = new Date();
  try {
    const event = await google<{ id: string }>('POST', at(calendarId), {
      summary: `Jarvis code: ${code}`,
      description: 'Type this code in the family hub app to connect this calendar. It deletes itself when you do.',
      start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: new Date(start.getTime() + 15 * 60_000).toISOString(), timeZone: TIME_ZONE },
    });
    challenges.set(userId, { calendarId, code, googleEventId: event.id, expires: Date.now() + CHALLENGE_MS, tries: 0 });
  } catch {
    throw new BadRequestException("Couldn't reach Google. Is the hub online?");
  }
}

// The calendar waiting for this person's code, if any.
export function pendingCalendar(userId: number) {
  const challenge = challenges.get(userId);
  return challenge && challenge.expires > Date.now() ? challenge.calendarId : null;
}

// Right code → the calendar id (and the code event is deleted). Wrong 5 times or too late → start again.
export async function finishChallenge(userId: number, code: string) {
  const challenge = challenges.get(userId);
  if (!challenge || challenge.expires < Date.now()) {
    await dropChallenge(userId);
    throw new BadRequestException('No code is waiting (or it expired). Tap Connect again.');
  }
  if (code.trim() !== challenge.code) {
    challenge.tries += 1;
    if (challenge.tries < CHALLENGE_TRIES) {
      throw new BadRequestException('Wrong code. Look for "Jarvis code" in that Google Calendar today.');
    }
    await dropChallenge(userId);
    throw new BadRequestException('Too many wrong codes. Tap Connect again.');
  }
  await dropChallenge(userId);
  return challenge.calendarId;
}

export async function dropChallenge(userId: number) {
  const challenge = challenges.get(userId);
  challenges.delete(userId);
  if (challenge) {
    await removeFromGoogle({ googleEventId: challenge.googleEventId, googleCalendarId: challenge.calendarId }).catch(() => {});
  }
}

export async function setFamilyCalendar(prisma: PrismaService, calendarId: string | null) {
  if (calendarId) {
    await prisma.setting.upsert({ where: { key: FAMILY_KEY }, update: { value: calendarId }, create: { key: FAMILY_KEY, value: calendarId } });
  } else {
    await prisma.setting.deleteMany({ where: { key: FAMILY_KEY } });
  }
}

// After a calendar is connected, changed or disconnected: copy those events again (or remove the old copies).
export async function resyncEvents(prisma: PrismaService, where: Prisma.EventWhereInput) {
  lastTry.clear();
  await prisma.event.updateMany({ where, data: { googleSyncedAt: null } });
}

// The Google copy of a deleted event. Best effort: if Google can't be reached, the copy stays.
export async function removeFromGoogle(event: Pick<Event, 'googleEventId' | 'googleCalendarId'>) {
  if (!googleEnabled() || !event.googleEventId || !event.googleCalendarId) return;
  await google('DELETE', at(event.googleCalendarId, event.googleEventId)).catch((error) => {
    if (!gone(error)) throw error;
  });
}

function toGoogle(event: Event) {
  const end = new Date(event.startsAt.getTime() + EVENT_MINUTES * 60_000);
  return {
    summary: event.title,
    description: 'Added with Jarvis, the family hub.',
    start: { dateTime: event.startsAt.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
  };
}

let syncing = false;
const lastTry = new Map<number, number>(); // event id → when it last failed

// Called by the scheduler every 10 s (not awaited, so alarms never wait for Google): copies new and changed events
// (from yesterday on) to the right Google calendar. Offline or refused → tried again a minute later.
export async function syncGoogle(prisma: PrismaService) {
  if (!googleEnabled() || syncing) return;
  syncing = true;
  try {
    for (const [userId, challenge] of challenges) if (challenge.expires < Date.now()) await dropChallenge(userId); // stale codes
    const events = (await prisma.event.findMany({ where: { startsAt: { gte: new Date(Date.now() - 24 * 3600_000) } } })).filter(
      (e) => !e.googleSyncedAt || e.updatedAt > e.googleSyncedAt,
    );
    if (!events.length) return;
    const [people, family] = await Promise.all([
      prisma.user.findMany({ where: { googleCalendarId: { not: null } }, select: { id: true, googleCalendarId: true } }),
      familyCalendar(prisma),
    ]);
    for (const event of events) {
      if (Date.now() - (lastTry.get(event.id) ?? 0) < RETRY_MS) continue;
      const target = event.userId ? (people.find((p) => p.id === event.userId)?.googleCalendarId ?? null) : family;
      try {
        let googleEventId = event.googleEventId;
        if (googleEventId && event.googleCalendarId !== target) {
          await removeFromGoogle(event); // moved to someone else, or their calendar was disconnected
          googleEventId = null;
        }
        if (target && googleEventId) {
          googleEventId = await google<{ id: string }>('PATCH', at(target, googleEventId), toGoogle(event)).then(
            (copy) => copy.id,
            (error) => (gone(error) ? null : Promise.reject(error)), // deleted in Google: make a new copy
          );
        }
        if (target && !googleEventId) googleEventId = (await google<{ id: string }>('POST', at(target), toGoogle(event))).id;
        const now = new Date();
        await prisma.event.update({
          where: { id: event.id },
          data: { googleEventId, googleCalendarId: target, googleSyncedAt: now, updatedAt: now },
        });
        lastTry.delete(event.id);
      } catch {
        lastTry.set(event.id, Date.now());
      }
    }
  } finally {
    syncing = false;
  }
}
