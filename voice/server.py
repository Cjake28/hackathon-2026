# OWNER: voice-mouth. HTTP on config.PORT (4103): POST /speak {text} -> tts.say -> {ok:true};
# GET /health -> {ok, listening, lastSpeaker}.
import threading

import uvicorn
from fastapi import FastAPI

import config
import state
import tts

app = FastAPI()


@app.post('/speak')
def speak(body: dict):
    tts.say(str(body.get('text') or ''))
    return {'ok': True}


@app.get('/health')
def health():
    return {'ok': True, 'listening': state.listening, 'lastSpeaker': state.last_speaker}


def start() -> None:
    """Start the server in a background thread. Returns immediately."""
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=config.PORT, log_level='warning'))
    threading.Thread(target=server.run, daemon=True, name='server').start()
    print(f'Voice server on http://127.0.0.1:{config.PORT}')


if __name__ == '__main__':  # python server.py: just the mouth, no mic loop
    import time
    start()
    state.listening = False
    while True:
        time.sleep(1)
