# Mobile to-do (Vincent)

What's left in the app, most important for the demo first. The code for each item is in `docs/mobile-hub.md`
(the section is in brackets), typechecked against the current `mobile/`. Checked against `main` on 2026-10-10.

## Already done ✅

Login · poll + full-screen alarm (`HubListener`) · Alarms, Tasks (checkbox + points), Family from the hub ·
Talk to Jarvis · briefing · grocery · memory · "Jarvis heard…" · Accounts and Roles for parents. Nice work.

## To do

### 🔴 1. Calendar from the hub [13]
`calendar.tsx` still shows a fixed `EVENTS` list, so events Jarvis adds by voice never appear on the phone.
- [ ] `HubEvent` type, and `'event:soon'` in `NoticeKind` [13.1]
- [ ] `useEvents` / `useCreateEvent` / `useUpdateEvent` / `useDeleteEvent` in `useHub.ts`, plus `'event:soon': ['events']` in `REFRESH` [13.2]
- [ ] Replace `calendar.tsx`: it keeps your design, takes the data from the hub, has an "Add, move or cancel with Jarvis" button, and deletes on long-press [13.4]
- [ ] Check it [13.6]

### 🔴 2. The alarm can't be missed on stage [9]
It only vibrates now. A silent phone ruins demo step 6.
- [ ] `npx expo install expo-audio expo-keep-awake`, and add a sound at `assets/alarm.mp3`
- [ ] The looping sound + `useKeepAwake()` in `HubListener` [9]

### 🟡 3. Popups for parents [5, 13.3]
In `showNotice()` in `HubListener.tsx`:
- [ ] `alarm:ignored` → "⏰ Alarm still ringing: Ana's alarm has been ringing for 2 minutes." (and add `'alarm:ignored'` to `NoticeKind`)
- [ ] `event:soon` → "📅 Coming up: Ana, piano lesson in 15 minutes."

### 🟡 4. Jarvis talks back on the phone [12.4]
- [ ] `Speech.speak(reply.reply)` after each reply (`expo-speech` is already installed), and stop it when leaving the screen
- [ ] The big 🎤 opens the keyboard (`inputRef.current?.focus()`). The keyboard's mic does the speech-to-text.
- [ ] Calendar suggestions in `SUGGESTIONS` [13.5]

### 🟡 5. Hub address, to use the app away from home [12.2, 12.3]
Only needed for the "Ana asks Jarvis from school" moment (Cloudflare tunnel).
- [ ] Replace `lib/api.ts` (the hub address can be changed on the phone and is saved)
- [ ] `components/HubAddress.tsx` in Settings and on the login screen

### 🟡 6. Google Calendar in Settings [14]
The hub copies each person's events to their own Google Calendar once they connect it (`docs/google-calendar.md`).
- [ ] `GoogleStatus` type + `useGoogle` / `useConnectGoogle` / `useVerifyGoogle` / `useConnectFamilyGoogle` [14.1, 14.2]
- [ ] `components/GoogleCalendar.tsx` in Settings: share → Gmail → the one-time code from that calendar [14.3], then check it [14.4]

### 🟢 7. Roadmap screen matches what we demo
- [ ] `roadmap.tsx` #13 says "camera verification, before and after photos … `demo: true`". Chores are now
      **checked off without photos**: reword it (e.g. "Chores: the kid checks it off, parents see it, +10 points") or set
      `demo: false` so the judges aren't promised a photo check.

## Don't
- No camera or photo check for chores (decided: a checkbox only).
- No Google login and no sign-up screen (Mom and Dad make the accounts).
- Don't change `api/`: ask the Hub dev.

## When you're done
Run the checks in `docs/mobile-hub.md`: section 11 (alarm and tasks), 12.5 (away from home), 13.6 (calendar),
14.4 (Google Calendar).
