# OWNER: voice-id. python enroll.py --user-id 4 -> records 6 sentences -> profiles/4.npy (averaged embedding).
# Names/ids come from hub.get_people(). Audio is never saved, only the embedding.
import argparse

import numpy as np
import sounddevice as sd

import config
import hub
import voiceid

SENTENCES = [
    'Good morning! What is on the calendar today?',
    'Pakigising mo ako ng alas sais bukas ng umaga.',
    'Add milk, eggs and bread to the grocery list.',
    'Sino ang nasa bahay ngayon? I just got home.',
    'Hey Jarvis, set an alarm for six thirty.',  # short commands: real clips are short
    'Ano ang gagawin ko today? Remind me to call Lola after dinner.',
]
SECONDS = 7


def record() -> np.ndarray:
    a = sd.rec(int(SECONDS * config.SAMPLE_RATE), samplerate=config.SAMPLE_RATE, channels=1, dtype='float32')
    sd.wait()
    return voiceid.trim(a[:, 0])


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--user-id', type=int, required=True)
    p.add_argument('--mock', action='store_true')
    args = p.parse_args()
    config.MOCK = args.mock

    person = next((x for x in hub.get_people() if x['id'] == args.user_id), None)
    if not person:
        raise SystemExit(f'No user with id {args.user_id} on the hub.')
    print(f"Enrolling {person['name']} ({person['role']}). Read each sentence after pressing Enter ({SECONDS} s).")
    voiceid._load()  # load the model before the first recording

    vecs = []
    for i, s in enumerate(SENTENCES, 1):
        input(f'\n[{i}/{len(SENTENCES)}] Press Enter, then say:\n  "{s}"')
        print('  recording...')
        a = record()
        if np.abs(a).max() < 0.01:
            print('  (very quiet: check the mic)')
        vecs.append(voiceid.embed(a))
        print('  ok')

    v = np.mean(vecs, axis=0)
    v = (v / np.linalg.norm(v)).astype(np.float32)
    config.PROFILES_DIR.mkdir(exist_ok=True)
    out = config.PROFILES_DIR / f'{args.user_id}.npy'
    np.save(out, v)
    sims = [float(np.dot(x, v)) for x in vecs]
    print(f"\nSaved {out} for {person['name']}. Per-sentence similarity to profile: {[round(x, 2) for x in sims]}")
