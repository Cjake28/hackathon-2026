# voice/: the hub's ears and mouth (Python)

Owner: **Voice dev**. Full contract: `TEAM-PLAN.md` sections 4.5, 4.7 and "Voice dev".

Runs on the hub laptop next to the API. Wake word → record → speech-to-text + voice ID → `POST /api/voice/command` →
speak the reply. Also serves `POST /speak` so the hub can talk (alarms, new tasks, "welcome home").

## Run it

```
py -3.11 -m venv C:\Users\<you>\Desktop\voice-venv          # Python 3.11 (newer versions break some libraries)
C:\Users\<you>\Desktop\voice-venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env    # fill in HUB_KEY (same as api/.env), ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
```

`voice/models/` (~420 MB: ECAPA, Kokoro) is git-ignored. Copy it to the hub laptop by USB (otherwise the first run downloads it, which needs internet).

```
python main.py --mock          # push-to-talk, no hub needed. Enter = talk, 1-5 = force speaker, 0 = auto
python main.py --wake          # "hey jarvis", talks to the real hub
python enroll.py --user-id 4   # record 4 sentences -> profiles/4.npy (ids from GET /voice/people)
python voiceid.py              # record once, print every profile's score (tune ID_THRESHOLD in .env)
python pregen.py               # online: clips/phrases.txt -> clips/*.wav (exact lines play without internet)
```

What's used for each job: speech-to-text is ElevenLabs Scribe, falling back to local faster-whisper when offline (`ELEVENLABS_STT=false` = local only). Speech is a saved clip first, then ElevenLabs (George), then local Kokoro, then pyttsx3. Wake word (openwakeword) and voice ID (SpeechBrain ECAPA) are always local.
The console shows which one ran (`[stt: scribe]`, `[tts: clip]`, ...). With no internet everything still works, just with the local options.

## Contract (don't change without telling the team)

**This service → hub**

```
POST {HUB_URL}/voice/command
x-hub-key: {HUB_KEY}
{ "speakerId": 4 | null, "confidence": 0.87, "text": "wake Ana up in one minute" }
→ { "reply": "...", "speaker": { "id": 4, "name": "Ana", "role": "child" }, "pending": false }
```

`speakerId: null` = unknown voice → the hub answers as the Guest user. Speak `reply` out loud.

```
GET {HUB_URL}/voice/people      (x-hub-key)  → [{ "id": 4, "name": "Ana", "role": "child" }, ...]
```

Use it in enrollment to get real user ids.

**Hub → this service** (`http://127.0.0.1:4103`)

```
POST /speak  { "text": "Ana, wake up!" }  → { "ok": true }     queue it, never talk over yourself
GET  /health                              → { "ok": true, "listening": true, "lastSpeaker": "Ana" }
```

## Suggested stack (spike each on the hub laptop first; switch to the fallback after 30 min of install pain)

| Job | Library | Notes |
|---|---|---|
| Mic | `sounddevice` | 16 kHz mono |
| Speech-to-text | `faster-whisper`, multilingual `small` (or `base`), int8 on CPU | Multilingual = Tagalog/Taglish nearly free |
| Wake word | `openwakeword`, ready `hey_jarvis` model | `inference_framework="onnx"` on Windows |
| Voice ID | SpeechBrain ECAPA `speechbrain/spkrec-ecapa-voxceleb` + cosine similarity | Fallback: `resemblyzer` |
| Text-to-speech | `pyttsx3` (Windows voices, offline) | One TTS thread + a queue (not thread-safe) |
| All-in-one fallback | `sherpa-onnx` | Keyword spotting, speech-to-text, speaker ID, text-to-speech |

Download every model **before the event** (needs internet), on the hub laptop.

## Must-haves

- Push-to-talk first (Enter = record until silence or 8 s). Wake word after the whole chain works.
- `python enroll.py --user-id 4` → 3–5 sentences → averaged embedding in `profiles/4.npy` (git-ignored: privacy).
- Mute the mic while speaking, or Jarvis hears itself.
- Keys `1`–`5` force the next speaker, `0` = automatic (the on-stage fallback).
- `--mock`: no hub needed, print what would be sent and speak "mock reply".
- Audio is never saved to disk, only transcribed in memory.

## Test the hub side without Python

```
curl -X POST http://localhost:4101/api/voice/command -H "content-type: application/json" \
  -H "x-hub-key: <HUB_KEY from api/.env>" -d "{\"speakerId\": null, \"confidence\": 0.4, \"text\": \"who is home\"}"
```
