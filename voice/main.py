# The voice loop: python main.py [--mock] [--wake]
# Push-to-talk: Enter = record. Type 1-5 then Enter = force the next speaker, 0 = automatic.
import argparse

import config
import state

p = argparse.ArgumentParser()
p.add_argument('--mock', action='store_true', help='no hub needed: print what would be sent')
p.add_argument('--wake', action='store_true', help='"hey jarvis" instead of push-to-talk')
args = p.parse_args()
config.MOCK = args.mock

import audio, hub, server, stt, tts, voiceid, wake  # noqa: E402  (after config.MOCK is set)

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
        text = stt.transcribe(clip)
        if not text.strip():
            continue
        if state.forced_speaker:
            uid, name, score = state.forced_speaker, names.get(state.forced_speaker), 1.0
            state.forced_speaker = None
        else:
            uid, name, score = voiceid.identify(clip)
        print(f"[{name or 'guest'} {score:.2f}] {text}")
        state.last_speaker = name or 'guest'

        res = hub.send_command(uid, score, text)
        tts.say(res['reply'])
    except KeyboardInterrupt:
        break
    except Exception as e:  # keep the loop alive on stage
        print('  error:', e)
