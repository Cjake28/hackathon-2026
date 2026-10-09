# The voice loop: python main.py [--mock] [--wake]
# Push-to-talk: Enter = record. Type 1-5 then Enter = force the next speaker, 0 = automatic.
import argparse
import random
import sys

import config
import state

p = argparse.ArgumentParser()
p.add_argument('--mock', action='store_true', help='no hub needed: print what would be sent')
p.add_argument('--wake', action='store_true', help='"hey jarvis" instead of push-to-talk')
args = p.parse_args()
sys.stdout.reconfigure(encoding='utf-8', errors='replace')  # Tagalog text in a piped/redirected console (cp1252) crashed print()
config.MOCK = args.mock

import audio, hub, server, stt, tts, voiceid, wake  # noqa: E402  (after config.MOCK is set)

# Said the moment someone stops talking, while speech-to-text and the hub work, so the wait sounds like thinking, not
# freezing (TEAM-PLAN, Voice step 5). Only pre-recorded clips (clips/phrases.txt, python pregen.py): they play
# instantly and offline. A filler generated live would add delay instead.
FILLERS = [f for f in ['Hmm.', 'Okay.', 'Sige.', 'Let me check.'] if tts.clip_path(f).exists()]
awaiting_yes = False  # the last reply asked "Say yes to confirm": yes/no comes back in 0.3 s, no filler needed

names = {u['id']: u['name'] for u in hub.get_people()}
server.start()
state.listening = True
print(f"Jarvis listening ({'wake word' if args.wake else 'push-to-talk'}{', mock' if args.mock else ''}). Ctrl+C to stop.")

while True:
    try:
        if args.wake:
            wake.wait_for_wake()
        else:
            key = input('Enter = talk, 1-5 = force speaker, 0 = auto > ').strip()
            if key in '012345' and key:
                state.forced_speaker = int(key) or None
                print(f"  speaker: {names.get(state.forced_speaker, 'auto')}")
                continue

        clip = audio.record()
        if len(clip) and FILLERS and not awaiting_yes:
            tts.say(random.choice(FILLERS))  # only queued: plays while we transcribe and ask the hub
        text = stt.transcribe(clip)
        secs = len(clip) / config.SAMPLE_RATE
        if not text.strip():
            print(f'  (heard nothing in {secs:.1f} s: speak right after "listening...")')
            continue
        if secs < 2:
            print(f'  (short clip {secs:.1f} s: voice ID is unreliable, say a full sentence)')
        if state.forced_speaker:
            uid, name, score = state.forced_speaker, names.get(state.forced_speaker), 1.0
            state.forced_speaker = None
        else:
            uid, name, score = voiceid.identify(clip)
        print(f"[{name or 'guest'} {score:.2f}] {text}")
        if uid is None:
            print(f'  unknown voice (score {score:.2f} < {config.ID_THRESHOLD}) -> guest')
        state.last_speaker = name or 'guest'

        res = hub.send_command(uid, score, text)
        awaiting_yes = bool(res.get('pending'))
        tts.say(res['reply'])
    except (KeyboardInterrupt, EOFError):
        break
    except Exception as e:  # keep the loop alive on stage
        print('  error:', e)
