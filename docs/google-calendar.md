# Google Calendar (online extra)

The events Jarvis adds ("Hey Jarvis, study group tomorrow at 3") also show up in the person's own Google Calendar,
within seconds. **Events are saved on the hub first.** Google only gets a copy, so the calendar keeps working with
the internet off.

## How it works

```
Ana: "Jarvis, set a study group tomorrow at 3 PM" → "yes"
  → ① saved on the hub (works offline)
  → ② the hub's scheduler (every 10 s) copies it to ana.cruz@gmail.com's Google Calendar
  → it shows up in the Google Calendar app on Ana's phone
```

- **The hub has its own Google "robot" account** (a service account: `jarvis-hub@<project>.iam.gserviceaccount.com`).
  It logs in with a key file, with no OAuth and no one's password.
- **Proving it's your calendar: share + a one-time code.**
  - Ana shares *her own* calendar with that robot address and types her Gmail in the app.
  - The hub checks that the calendar is shared, then puts an event **"Jarvis code: 482913"** in it.
  - Ana types the code. Only someone who can see that calendar can read it.
  - Sharing alone isn't proof: the whole family shares with the same robot. Without the code, Ana could connect Mom's
    calendar by typing Mom's Gmail. With it, the code lands in Mom's calendar, so Ana can't connect it and Mom sees
    the attempt.
  - The code works for 10 minutes and 5 tries. **One calendar = one account**, and a personal calendar can't be the
    Family calendar.
- **Where an event goes:**

  | Event | Google Calendar |
  |---|---|
  | Ana's (she said it, or Mom said "piano for Ana") | Ana's calendar |
  | Mom's | Mom's calendar |
  | Family event (no one person) | The **Family** calendar a parent connected |
  | The person hasn't connected a calendar | Stays on the hub only |

- **Changes follow:** moving or renaming an event updates the copy. Deleting it, cancelling it by voice or saying
  "cancel that" removes it. Giving the event to someone else moves it to their calendar. Disconnecting removes the
  copies Jarvis made.
- **Offline:** saved on the hub, and copied when the internet is back (it retries every minute).

Code: `api/src/calendar/google-calendar.ts` (sync and the one-time code, no extra library: the service account's JWT
is signed with Node's crypto) and `google.controller.ts` (`GET /api/google`, `PATCH /api/google/me`,
`PATCH /api/google/me/verify`, `PATCH /api/google/family`).

## Setup (once, on the hub laptop): whoever has the GCP project

1. [console.cloud.google.com](https://console.cloud.google.com) → the project (Brain's GCP credits) → **APIs & Services
   → Enable APIs** → **Google Calendar API** → Enable.
2. **IAM & Admin → Service accounts → Create service account**, named e.g. `jarvis-hub`. It needs no roles.
3. Open it → **Keys → Add key → Create new key → JSON**. A file downloads.
4. Save it on the hub laptop as **`api/google-key.json`**. It's git-ignored: **never commit it or paste it in a chat**,
   because it's the robot's password. A different path goes in `api/.env`: `GOOGLE_SERVICE_ACCOUNT_FILE=…`.
5. Restart the API. Check: `GET /api/google` (logged in) → `"enabled": true, "shareWith": "jarvis-hub@…"`.

No key file = the feature is off and everything else works as before.

## Each person (once)

1. On a computer, [calendar.google.com](https://calendar.google.com) → ⚙️ Settings → under *Settings for my calendars*,
   click your calendar → **Share with specific people or groups → Add people** → paste the **shareWith** address →
   permission **"Make changes to events"** → Send. (Phones can't change sharing; use the website.)
2. App → Settings → **Google Calendar** → type your Gmail → **Connect**.
   If you see "Share that calendar with jarvis-hub@… first", step 1 isn't done. "Jarvis can only see that calendar"
   means the permission is "See all event details": change it to "Make changes to events".
3. Open your Google Calendar: there's an event **"Jarvis code: ……"** today. Type the code in the app → **Verify** →
   "Connected". The code event deletes itself.

## Family calendar (a parent, once)

1. calendar.google.com → *Other calendars* **+** → **Create new calendar** → "Family".
2. Share it with the **shareWith** address ("Make changes to events") and with each family member, so they see it.
3. Its settings → **Integrate calendar → Calendar ID** (`…@group.calendar.google.com`) → App → Settings →
   **Family calendar** → paste → Connect.

## Privacy

Google gets the **title and time** of events, and only for calendars people chose to connect. Voice, photos and
memory notes never leave the hub. Say it this way on stage: "Your calendar can sync to Google if you want; Jarvis's
brain stays home."

## Limits

- A child needs their own Google account (under 13: a Family Link account). Without one, their events stay on the hub
  and in the app.
- **No invitations to other people.** A service account can't send invites from personal Gmail without OAuth. Shared
  plans go in the Family calendar instead.
- One way only: hub → Google. Edits made in Google Calendar don't come back to the hub.
- Events are 1 hour long in Google (the hub has no end time), and only events from yesterday on are copied.
