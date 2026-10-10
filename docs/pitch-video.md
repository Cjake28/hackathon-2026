# Onai: 65-second pitch video (build brief)

You are a senior motion designer and product narrator. Build a **65.0 s pitch video for Onai** with **HyperFrames**
(HTML + GSAP → MP4). It plays on stage at a hackathon whose theme is:

> **Local AI.** Useful AI where the real computing happens on the user's device, not only in the cloud.
> Build an AI product that stays genuinely useful when the cloud disappears.

The video must prove three things, in this order:
1. **The problem is real.** When the cloud goes away, cloud assistants go silent, and that happens a lot here.
2. **Onai is like a mother for the whole house**, and its name says so (Ina + On + AI). It wakes the kids and tells
   them their day, keeps the family calendar, hands out tasks even when Mom is out and reminds the kid what's left,
   calls everyone to dinner, knows who's home, and tells strangers nothing.
3. **It keeps working with the internet off**, on one ordinary laptop, with real measured numbers.

Everything below comes from the repo `C:\Users\John Mark\hackathon-2026` (read `TEAM-PLAN.md`, `CLAUDE.md`, `mobile/`,
`api/src/`, `voice/`, `ai-bench.md`). **Read the files named here before you build. Don't guess, and don't invent
screens, colours, copy or features.** If something you need isn't in this brief or the repo, leave it out.

---

## 0. Truth rules (a judge will check these against the live demo)

**Allowed: built and working** (checked in code on 10 Oct 2026):

| Feature | Where it lives |
|---|---|
| Talk to Onai (typed or tap-to-talk), and it asks "Say yes to confirm" before changing anything | `mobile/app/(app)/talk.tsx`, `api/src/voice/voice.controller.ts` |
| Parent sets a kid's alarm, the kid's phone rings full screen, and the hub says "JM, wake up!" | `mobile/components/HubListener.tsx`, `api/src/scheduler.service.ts` |
| Kid taps Dismiss on a wake-up alarm → the hub says the kid's good-morning briefing; the phone's "Good morning — what's my day?" button shows it as "Your day" | `api/src/briefing/wake-briefing.ts`, `mobile/app/(app)/(tabs)/index.tsx` |
| Calendar: Onai adds, moves and cancels events; 15 minutes before one, that person's phone shows "📅 Coming up" and the hub says "JM, Piano lesson in 15 minutes." | `mobile/app/(app)/calendar.tsx`, `api/src/scheduler.service.ts` |
| Task relay: a parent gives a task, "New task" pops up on the kid's phone and the hub says it | `api/src/tasks/`, `api/src/ai/tools.ts`, `HubListener.tsx` |
| "Welcome home, JM", then "You have 2 tasks left: …" | `api/src/location/welcome.ts` |
| Intercom: "Tell everyone dinner's ready" → every phone shows "📢 Announcement" and the hub says "Announcement from Mom: …" | `announce` in `api/src/ai/tools.ts`, `HubListener.tsx` |
| Who's home (phone reached the hub on home Wi-Fi in the last 2 min) and "Where everyone is" ("At School since…") | `family.tsx`, `index.tsx`, `whereabouts.tsx`, `api/src/location/` |
| Unknown voice = guest: "I don't recognize your voice, so I can't share family info." | `voice.controller.ts` |
| The AI brain runs on the hub laptop (Ollama, `qwen3.5:4b`), and Onai answers with the internet off | `CLAUDE.md`, `ai-bench.md` |

**Banned. Never show or say any of these:**

- The **Network / site-blocking / device pause** screens (`network.tsx`, `device/[id].tsx`). They run on made-up
  devices stored on the phone (`SEED_DEVICES` in `mobile/hooks/useNetwork.ts`). Not built.
- The **Settings toggles** "Wake word", "Speak out loud", "Remember preferences". They're only saved on the phone and
  change nothing on the hub.
- **"Hey Onai" as a wake word.** The hub's real wake word is still "hey jarvis" (`voice/README.md`). Show tap-to-talk
  ("Tap to talk to Onai") or typed requests instead.
- **A fake "no confirm" screen.** The real app asks "Say yes to confirm" before an alarm, a task or an announcement.
  The video may cut past that moment, but never show a screen where it's missing.
- **Chore photo checking.** The API has it, but the app checks chores off without a photo.
- **"Your voice never leaves the house"** or "100% offline voice". When online, speech-to-text goes to ElevenLabs
  first (`ELEVENLABS_STT=true` in `voice/.env`). Say "the brain runs in your house" instead (true).
- **Anything away from home working with the internet off.** Mom giving tasks from work and "At School" both need the
  phone to reach the hub through the internet tunnel. Show them in the daily-life part, never in the internet-off part.
- Anything from the roadmap that isn't built: face ID, multi-room, SOS button, chore rotation, routine checklists,
  new-device alerts, device agent, Tagalog voice. Don't show the "What's coming" screen.
- **The app icon** (`mobile/assets/images/icon.png`). It's the default React atom, not an Onai logo. There is no logo:
  use the type-only wordmark (section 1).
- Fake statistics. The only outside number is the PAGASA typhoon average (beat 1). Every other number comes from
  `ai-bench.md` / `TEAM-PLAN.md` or from the team's fresh benchmark run.

---

## 1. Brand lock (from code)

Single **light** theme by design (`mobile/global.css`: "no dark mode variant"). Don't reskin it. The only dark frames
are beat 1 (the cloud dies) and the final fade.

| Token | Hex | Source |
|---|---|---|
| background | `#FFFFFF` | `--background` |
| ink / foreground | `#1E2921` | `--foreground` |
| brand green (primary) | `#25B15F` | `--primary` |
| primary edge (3D button/panel base) | `#197640` | `--primary-edge` |
| primary soft (user chat bubble) | `#E8F7EE` | `--primary-soft` |
| on primary soft | `#176D3B` | `--primary-soft-foreground` |
| sunken (Onai chat bubble, quiet cards) | `#F7F7F7` | `--sunken` |
| muted text | `#4F4F4F` | `--muted-foreground` |
| border | `#E0E0E0` | `--border` |
| destructive | `#D95E3F` | `--destructive` |
| teal soft / on soft ("What Onai heard", "Nice work!") | `#E9F7F5` / `#276860` | `--accent-teal-*` |
| amber (trophy) | `#B28134` | `--accent-amber-base` |

- **Type:** Fredoka (`mobile/assets/fonts/Fredoka-{Regular,Medium,SemiBold,Bold}.ttf`; copy them in and use
  `@font-face`). Headlines Bold, body SemiBold (the app's default), small print Regular.
- **Shape:** cards `border-radius: 24px` (`rounded-3xl`), **2px solid `#E0E0E0` border, no shadow**
  (`components/ui/card.tsx`). Buttons are chunky 3D: the face sits on a darker "edge" about 6px tall
  (`components/ui/button.tsx`). Base radius token 16px.
- **Icons:** Phosphor, `fill` weight (`phosphor-react-native` in the app; use `@phosphor-icons/web` or inline SVG).
  Real ones: Microphone, House, Users, Alarm, CheckSquare, Sun, Trophy, Ear, MapPin, Lock, Cloud.
- **Wordmark:** the word **Onai** in Fredoka Bold, `#25B15F` on white. No logo, no spin.
- **Visual signature:** the home screen's green **"Tap to talk to Onai"** panel: green face `#25B15F` on a `#197640`
  edge, a white mic in a `rgba(255,255,255,.2)` circle that pulses **scale 1 → 1.05, 900 ms, yoyo, loop** (the real
  Moti values in `mobile/app/(app)/(tabs)/index.tsx`), and the two badges "● On this hub" and "No internet needed".
- **Product truth (its own words):** "Your home hub · runs on this house" (home screen subtitle). On screen: **"Runs on
  this house."**
- **The name (from the team):** **Onai = Ina + On + AI.** *Ina* is Filipino for mother, *On* means always on, and
  *AI* is the brain. Explain it once, in beat 2.
- **The family:** the kid is **JM**, the parent is **Mom**. Dad and Ben appear only as extra phones in the intercom
  beat.

---

## 2. The cut: 65.0 s, 1920×1080, 30 fps, 16:9

Phones are shown as a **plain rounded rectangle** (no brand, no notch), about 860px tall, holding a real screen.
Safe margins 80px. Overlay text: max 4 words, Fredoka Bold 64px `#1E2921`, left side, phone on the right.

**Motion rules:** entrances ease-out cubic (`power3.out`), cuts ease-in-out (`power2.inOut`, 0.3 s). No bounce on the
whole frame. One moving thing at a time. Type slams (scale 1.12 → 1, 0.35 s), cards and phones slide 24px, buttons
press with scale 1 → 1.04 → 1 (0.25 s). Hold every readable line at least 1.2 s. Cut on the voice, never through it.

### Two voices

NARRATOR = the pitch voice (ElevenLabs, section 3). Make it clearly different from Onai's voice, so the audience can
tell the narrator from the product.

ONAI = the product's own voice: the hub's saved clips in `voice/clips/` (filename = sha1 of the lowercased text).
These are the exact words the hub says in each moment:

| # | Onai says | File | Status |
|---|---|---|---|
| C1 | "JM, wake up!" | `voice/clips/cb1bdc0a4482e80306cdcd2172da71b1586af5d8.wav` | to make, ~1.0 s |
| C2 | JM's good-morning briefing: the **exact text** the app shows in "Your day" for JM (AI-written, 2–4 short sentences) | sha1 of that text | to make |
| C3 | "JM, Piano lesson in 15 minutes." | `voice/clips/0373f0bde61df622346c26ef25a82656412c3072.wav` | to make, ~2.0 s |
| C4 | "Welcome home, JM" | `voice/clips/5bc5be8a5d784e1b9913548d4d4d02bc66783e71.wav` | to make, ~1.3 s |
| C5 | "You have 2 tasks left: wash the dishes and finish math homework." | `voice/clips/88c806588eb6d0e19f7133d2b432a0ac8c2ff704.wav` | to make, ~3.5 s |
| C6 | "Announcement from Mom: Dinner is ready" (use the words the hub actually said; the AI picks them) | `voice/clips/0ffcbd71d265fe428306a20a13c46000a8ea6a76.wav` if the words match | to make, ~2.5 s |
| C7 | "I don't recognize your voice, so I can't share family info." | `voice/clips/a85c9144c04f71f1f670d0f333cacb1c66cefd90.wav` | exists, 3.81 s |

**How to make C1–C6 in the hub's own voice:** add each line, exactly as written, to `voice/clips/phrases.txt`, then run
`python pregen.py` in `voice/` (needs internet and the ElevenLabs key in `voice/.env`). It saves each one under the
filename above. This is the same voice the hub uses for every reply when online. Measure each clip with `ffprobe` and
adjust the beat if it's longer than shown. If you can't run it, ask the user for the files. Don't use another voice.

**C2, the briefing:** use only the first one or two sentences, at most 4.0 s, cut at a sentence end. If the first
sentence is longer, tap "Good morning — what's my day?" again (each run writes a new one) until a short one comes.
Never edit the words.

### Set up the real data first

1. On the hub: `npm run db:seed`.
2. As Mom, add **JM** in the app (Hub → Family accounts, role **child**). Reseeding keeps accounts and resets
   everything else.
3. As Mom, through Onai, in this order:
   - give JM the chore "Wash the dishes", then the task "Finish math homework" (the order makes C5 read right);
   - add "Piano lesson" for JM about 16 minutes from now, and wait for the "📅 Coming up" alert;
   - set "Wake JM up in four minutes", let it ring, and tap Dismiss as JM;
   - "Tell everyone dinner's ready".
4. Take the screenshots below as each thing happens.

### Beat sheet

| Time | Beat | Visual + motion | On-screen text | Audio |
|---|---|---|---|---|
| **0.0–9.0** | **Problem** | Pure black. 0.5 **HIT**: "20" slams in center (Fredoka Bold 280px white). 0.9: "typhoons a year" slides up 24px (0.4 s). "Source: PAGASA" 22px, white 50%, bottom-left. 4.4 cross-cut (0.4 s) to a white Phosphor **Cloud** icon, 160px. 6.0 **HIT**: it becomes **CloudSlash**, opacity 1 → 0.35 (0.3 s). 6.2: text fades up. | "20 typhoons a year" → "No internet. No assistant." | NARRATOR 0.4–8.8 |
| **9.0–16.0** | **Meet Onai: the name** | 9.0 **HIT**, cut to white. Wordmark "Onai" (200px, `#25B15F`) slams center, lands by 9.35. 10.0: it slides up to the top third (0.4 s, ease-in-out). Three rows build under it, one slam each, left-aligned as a block: 10.4 **"INA"** (96px Bold `#25B15F`) + "mother, in Filipino" (48px SemiBold `#1E2921`); 11.7 **"ON"** + "always on"; 13.1 **"AI"** + "in your house". All three stay until the cut. | "INA · mother, in Filipino" / "ON · always on" / "AI · in your house" | NARRATOR 9.3–9.9 · 10.4–11.4 · 11.7–12.9 · 13.1–15.7 · soft tick on each row |
| **16.0–25.5** | **Wakes JM, tells JM the day** | 16.0 cut. Phone **S1** (Mom, Talk) slides in from the right 24px (0.5 s). 17.4 Mom's bubble (`#E8F7EE`) "Wake JM up in four minutes" pops in (scale 0.96 → 1) and holds. 19.2 **HIT**, cut straight to **S2**: JM's full-screen green alarm (⏰, "Wake up", the time, "Dismiss", "Snooze 5 min"), fade in like the app. 20.6 "Dismiss" presses. 20.9 slide 24px to **S3**: the "Your day" sheet with the briefing text. | "Starts everyone's day" | NARRATOR 16.3–17.5 · ONAI C1 19.4–~20.4 · ONAI C2 21.1–≤25.2 |
| **25.5–31.0** | **Keeps the calendar** | 25.5 cut. **S4**: the Calendar screen ("Calendar", "… coming up", green "Add, move or cancel with Onai", "Piano lesson" in the list). 28.6 **HIT**, slide 24px to **S5**: JM's phone alert "📅 Coming up" / "JM, Piano lesson in 15 minutes." | "Keeps the family schedule" | NARRATOR 25.7–28.6 · ONAI C3 28.8–~30.8 |
| **31.0–41.0** | **Mom's out, JM still knows** | 31.0 cut. **S6** (Mom, Talk): bubble "Give JM a chore: wash the dishes". 32.9 slide to **S7**: JM's "New task" alert "Mom: Wash the dishes". 35.6 **HIT**, cut to **S8**: JM's Tasks tab with "Wash the dishes" and "Finish math homework". | "Remembers what's left" | NARRATOR 31.1–35.6 · ONAI C4 35.8–~37.1 · ONAI C5 37.3–~40.8 |
| **41.0–46.5** | **Calls everyone** | 41.0 cut. **S9** (Mom, Talk): bubble "Tell everyone dinner's ready". 42.0 **HIT**: **S10**, up to three phones side by side (JM, Dad, Ben), not overlapping, each with "📢 Announcement" / "Mom: Dinner is ready". They slide up 24px together. Only one phone available = show one. | "Calls everyone at once" | ONAI C6 42.2–~44.6 · NARRATOR 44.8–46.4 |
| **46.5–50.5** | **Knows who's home** | 46.5 cut. **S11**: Mom's home screen, the green "Tap to talk to Onai" panel with the mic pulse (the signature) above "Who's home". 48.2 slide 24px to **S12**: "Where everyone is" with a row "At School since …". | "Knows who's home" | NARRATOR 46.7–50.1 |
| **50.5–54.8** | **Strangers get nothing** | 50.5 cut. **S13** (Guest, Talk): 50.6 "Who's home?" bubble, 50.9 Onai's refusal bubble with the clip. No narrator: Onai's line says it. | "Strangers get nothing" | ONAI C7 50.9–54.7 |
| **54.8–60.6** | **Internet off. Still working.** | 54.8 **HIT**, white. "Internet off." slams (120px). 55.6: a row of 4 stat cards (24px radius, 2px border) slides up 24px together. Optional: the team's real screen recording of the benchmark with Windows showing "No internet" (section 5), framed, instead of the cards. | "Internet off. Still working." | NARRATOR 55.0–60.6 |
| **60.6–65.0** | **End card + payoff** | 60.6 **HIT**. White. "Onai" wordmark (200px `#25B15F`) lands. 61.0: "Runs on this house." (56px SemiBold `#1E2921`) slides up 24px. 64.2–65.0 fade to black (ease-in-out). | "Onai" / "Runs on this house." | NARRATOR 60.8–64.2 |

**The 4 stat cards (beat 54.8).** Today's numbers from `ai-bench.md` + `TEAM-PLAN.md` (Brain section). **Replace them
with the team's fresh internet-off run if they send one:**

| Big number | Label under it |
|---|---|
| `43 tokens/s` | on a 4 GB laptop GPU |
| `0.9 s` | to pick the right action |
| `1.4–3.1 s` | per typed reply |
| `110/110` | demo lines right |

Footer, 20px muted: `qwen3.5:4b · Ollama · RTX 3050 4 GB laptop · 100% on GPU · measured 10 Oct 2026`

### Screens to capture (real app, real data)

Phone screenshots, portrait, light theme, into `assets/screens/`. Logins: `mom@family.local` and `guest@family.local`
(password `family123`), plus the JM account.

| Id | Login | Screen | Must show |
|---|---|---|---|
| S1 | Mom | Talk, right after sending "Wake JM up in four minutes" | Mom's bubble only: take it before Onai's reply appears, or crop the reply out |
| S2 | JM | Full-screen alarm | ⏰, "Wake up", time, "Dismiss", "Snooze 5 min" |
| S3 | JM | Home → "Good morning — what's my day?" | "Your day", "From Onai, on this hub" (or "Onai is talking…"), the briefing text used for C2 |
| S4 | Mom or JM | Hub → Calendar | "Calendar", "… coming up", "Add, move or cancel with Onai", "Piano lesson" |
| S5 | JM | Alert 15 min before the lesson | "📅 Coming up", "JM, Piano lesson in 15 minutes." |
| S6 | Mom | Talk, right after sending "Give JM a chore: wash the dishes" | Mom's bubble only |
| S7 | JM | Alert after the chore | "New task", "Mom: Wash the dishes" |
| S8 | JM | Tasks tab | "Tasks", "Wash the dishes", "Finish math homework" |
| S9 | Mom | Talk, right after sending "Tell everyone dinner's ready" | Mom's bubble only |
| S10 | JM (+ Dad, Ben if you have the phones) | Alert after the announcement | "📢 Announcement", "Mom: Dinner is ready" (the real words) |
| S11 | Mom | Home tab | "Hi Mom", "Your home hub · runs on this house", the green "Tap to talk to Onai" panel, "● On this hub", "No internet needed", "Who's home" |
| S12 | Mom | Hub → Where everyone is | someone "At School since …" (make a "School" place, share location from a 2nd phone) |
| S13 | Guest | Talk: "Who's home?" | "I don't recognize your voice, so I can't share family info." |

**If there are no screenshots:** rebuild each screen in HTML from its `.tsx` file. Copy labels word for word, and use
the tokens in section 1 and the card/button styles. Same layout, same order, no extra elements, and only the names
Mom, JM, Dad and Ben. No lorem ipsum, and no data the app didn't produce.

---

## 3. Voiceover

One narrator. Calm, close, mid pitch, slight smile, not an announcer. About 140 wpm with real pauses. 83 words total.
No hype words (incredible, revolutionary, seamless, game-changer, unlock). Say "Onai" as **ON-eye** (On + AI), "ina"
as **EE-nah**, and "JM" as **jay-em**. (Check them with the team; change this line if they say it differently.)

| Time | Line |
|---|---|
| 0.4 | About twenty typhoons a year enter our area. When one hits, the internet goes first. Cloud assistants go silent. |
| 9.3 | Onai. |
| 10.4 | Ina, mother. |
| 11.7 | On, always on. |
| 13.1 | A.I., in your house, not the cloud. |
| 16.3 | Mom asks once. |
| 25.7 | Fifteen minutes early, the calendar speaks up. |
| 31.1 | Mom's at work. Her chores still land on JM's phone. |
| 44.8 | Every phone, at once. |
| 46.7 | It knows who's home, and who's at school. |
| 55.0 | Now pull the internet. Onai still answers, in seconds, on a laptop. |
| 60.8 | A mother for every home. Never offline. |

(The exact speed is on the stat cards, so the line never needs changing.)

**ElevenLabs block** (paste as is; Multilingual v2 reads `<break>`; stability ~0.55, similarity ~0.75, style ~0.15):

```
About twenty typhoons a year enter our area. <break time="0.4s" /> When one hits, the internet goes first. <break time="0.3s" /> Cloud assistants go silent.
Onai.
Ina, mother.
On, always on.
A.I., in your house, <break time="0.2s" /> not the cloud.
Mom asks once.
Fifteen minutes early, the calendar speaks up.
Mom's at work. <break time="0.3s" /> Her chores still land on JM's phone.
Every phone, at once.
It knows who's home, and who's at school.
Now pull the internet. <break time="0.4s" /> Onai still answers, in seconds, on a laptop.
A mother for every home. <break time="0.4s" /> Never offline.
```

Generate **one file per line** (`vo/01.mp3` … `vo/12.mp3`) so each can be placed on its beat. If no ElevenLabs key is
available, ask the user for the files. Don't fake a voice with browser TTS.

---

## 4. Audio

- **Hits** (short low thump, no whoosh) at 0.5, 6.0, 9.0, 16.0, 19.2, 25.5, 28.6, 31.0, 35.6, 42.0, 46.5, 50.5,
  54.8, 60.6, plus a soft tick on each name row (10.4, 11.7, 13.1).
- **Bed:** a low, slow pulse (~70 bpm), quiet. **Duck it 6 dB** whenever the narrator or an Onai clip plays
  (0.15 s attack, 0.3 s release). No trailer riser, no big drop. It fades out with the picture, 64.2–65.0.
- If you can't make or license a bed and hits, make simple ones with FFmpeg (`sine`/`anoisesrc` + filters) and say
  so, or ask the user. No copyrighted music.
- Final mix: narrator ≈ -16 LUFS, peaks under -1 dBTP. Onai clips the same loudness as the narrator.

---

## 5. Build with HyperFrames

Needs Node 22+ (the hub laptop has 24) and **FFmpeg** (not installed yet: `winget install Gyan.FFmpeg`, then reopen
the terminal).

```
# skills for the agent (pick one)
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
# or: npx skills add heygen-com/hyperframes

# project OUTSIDE the team repo
cd "C:\Users\John Mark"
npx hyperframes init onai-pitch
cd onai-pitch
```

Copy in: `assets/fonts/` (the 4 Fredoka files), `assets/screens/` (S1–S13), `assets/clips/` (C1–C7), `vo/01–12`, the
bed and hit sounds.

Composition: root `<div id="stage" data-composition-id="onai" data-start="0" data-width="1920" data-height="1080">`.
Each element is a `class="clip"` with `data-start`, `data-duration` and `data-track-index` from the beat sheet.
Each audio file is an `<audio>` with the same attributes plus `data-volume`. One GSAP timeline, created
`{ paused: true }`, registered as `window.__timelines.onai`. Load GSAP from
`https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js`.

Then:

```
npx hyperframes lint
npx hyperframes inspect          # catches text spilling off the frame
npx hyperframes preview          # look at every beat
npx hyperframes render --help    # find the fps / quality / output flags of this version
npx hyperframes render ...       # 1920x1080, 30 fps
```

**Deliverable:** `onai-pitch.mp4`, H.264, yuv420p, AAC 48 kHz, 1920×1080, 30 fps, **65.0 s (never over)**, faststart.
If the render doesn't set faststart or yuv420p:
`ffmpeg -i render.mp4 -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -movflags +faststart onai-pitch.mp4`

**Before you say it's done**, run `ffprobe` and paste the output: duration, size, fps, codec, pix_fmt, audio codec.
Watch it once with sound and confirm:

- [ ] By second 20 a stranger knows what Onai does (a family assistant that runs in the house).
- [ ] Nothing from the banned list appears.
- [ ] No narrator line overlaps an Onai clip.
- [ ] Every on-screen line is held at least 1.2 s and stays inside the 80px margins.
- [ ] Every number on screen comes from `ai-bench.md`, `TEAM-PLAN.md`, the team's fresh benchmark, or PAGASA.
- [ ] If a clip runs long, take the time from the next beat's quiet part, then from the stat cards' hold. The total
      stays 65.0 s. Don't speed up any voice.

If a frame could belong to any app, rewrite it so it shows Onai's real screens, colours, or voice.
