# OWNER: voice-mouth. Run online, before the event: clips/phrases.txt -> clips/<sha1(text)>.wav via ElevenLabs.
# python pregen.py [--dry]   (--dry: only show what's missing and the character cost)
import sys

import requests
import soundfile as sf

import config
import tts

lines = [l.strip() for l in (config.CLIPS_DIR / 'phrases.txt').read_text(encoding='utf-8').splitlines()]
todo = [l for l in lines if l and not l.startswith('#') and not tts.clip_path(l).exists()]
cost = sum(len(l) for l in todo)
print(f'{len(todo)} clips to make, {cost} characters')

if todo and config.ELEVENLABS_API_KEY:
    sub = requests.get('https://api.elevenlabs.io/v1/user/subscription',
                       headers={'xi-api-key': config.ELEVENLABS_API_KEY}, timeout=10).json()
    left = sub['character_limit'] - sub['character_count']
    print(f"ElevenLabs: {sub['character_count']}/{sub['character_limit']} used, {left} left")
    if cost > left:
        sys.exit('Not enough characters left, aborting.')

if '--dry' in sys.argv or not todo:
    sys.exit()

for text in todo:
    sf.write(tts.clip_path(text), tts.eleven(text, timeout=30, model=tts.PREGEN_MODEL), tts.EL_RATE, subtype='PCM_16')
    print('  made', text)
