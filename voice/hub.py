# Talks to the hub API (TEAM-PLAN 4.5). --mock returns fake data so no hub is needed.
import requests

import config

MOCK_PEOPLE = [
    {'id': 1, 'name': 'Admin', 'role': 'admin'},
    {'id': 2, 'name': 'Mom', 'role': 'parent'},
    {'id': 3, 'name': 'Dad', 'role': 'parent'},
    {'id': 4, 'name': 'Ana', 'role': 'child'},
    {'id': 5, 'name': 'Ben', 'role': 'child'},
    {'id': 6, 'name': 'Guest', 'role': 'guest'},
]


def _headers():
    return {'x-hub-key': config.HUB_KEY}


def get_people() -> list[dict]:
    if config.MOCK:
        return MOCK_PEOPLE
    r = requests.get(f'{config.HUB_URL}/voice/people', headers=_headers(), timeout=5)
    r.raise_for_status()
    return r.json()


def send_command(speaker_id: int | None, confidence: float, text: str) -> dict:
    body = {'speakerId': speaker_id, 'confidence': round(confidence, 2), 'text': text}
    if config.MOCK:
        print(f'  (mock) POST /voice/command {body}')
        person = next((p for p in MOCK_PEOPLE if p['id'] == speaker_id), MOCK_PEOPLE[5])
        # Unknown voice -> guest line (a pregenerated clip), like the real hub's guest prompt
        reply = "I don't recognize your voice, so I can't share family info." if speaker_id is None else 'mock reply'
        return {'reply': reply, 'speaker': person, 'pending': False}
    r = requests.post(f'{config.HUB_URL}/voice/command', json=body, headers=_headers(), timeout=120)
    r.raise_for_status()
    return r.json()
