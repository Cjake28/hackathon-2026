# OWNER: voice-mouth. Text-to-speech on ONE worker thread with a queue (never talks over itself).
# Order: cached clip (clips/<sha1>.wav) -> ElevenLabs -> Kokoro (local) -> pyttsx3. Sets state.speaking while talking.
import hashlib
import queue
import threading
import time

import numpy as np
import requests
import sounddevice as sd
import soundfile as sf

import config
import state

EL_RATE = 22050  # pcm_22050 works on every ElevenLabs plan
KOKORO_VOICE = 'af_heart'

_q: queue.Queue[str] = queue.Queue()
_worker: threading.Thread | None = None
_lock = threading.Lock()
_kokoro = None  # loaded once, on the worker thread
_engine = None  # pyttsx3, created on the worker thread (not thread-safe)


def clip_path(text: str):
    return config.CLIPS_DIR / f"{hashlib.sha1(text.strip().lower().encode('utf-8')).hexdigest()}.wav"


def eleven(text: str, timeout: float = config.ELEVENLABS_TIMEOUT) -> np.ndarray:
    """ElevenLabs TTS -> int16 mono samples at EL_RATE. Raises on any error."""
    if not config.ELEVENLABS_API_KEY or not config.ELEVENLABS_VOICE_ID:
        raise RuntimeError('no ElevenLabs key/voice')
    r = requests.post(
        f'https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}',
        params={'output_format': f'pcm_{EL_RATE}'},
        headers={'xi-api-key': config.ELEVENLABS_API_KEY, 'content-type': 'application/json'},
        json={'text': text, 'model_id': 'eleven_multilingual_v2'},
        timeout=timeout,
    )
    r.raise_for_status()
    return np.frombuffer(r.content, dtype=np.int16)


def _play(samples: np.ndarray, rate: int) -> None:
    sd.play(samples, rate)
    sd.wait()


def _load_kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        _kokoro = Kokoro(str(config.MODELS_DIR / 'kokoro-v1.0.onnx'), str(config.MODELS_DIR / 'voices-v1.0.bin'))
    return _kokoro


def _pyttsx3(text: str) -> None:
    global _engine
    if _engine is None:
        import pyttsx3
        _engine = pyttsx3.init()
    _engine.say(text)
    _engine.runAndWait()


def _speak(text: str) -> None:
    path = clip_path(text)
    if path.exists():
        data, rate = sf.read(path, dtype='int16')
        print(f'  [tts: clip] {text}')
        return _play(data, rate)
    try:
        samples = eleven(text)
        print(f'  [tts: elevenlabs] {text}')
        return _play(samples, EL_RATE)
    except Exception as e:
        print(f'  (elevenlabs skipped: {e})')
    try:
        samples, rate = _load_kokoro().create(text, voice=KOKORO_VOICE, lang='en-us')
        print(f'  [tts: kokoro] {text}')
        return _play(samples, rate)
    except Exception as e:
        print(f'  (kokoro skipped: {e})')
    print(f'  [tts: pyttsx3] {text}')
    _pyttsx3(text)


def _run() -> None:
    while True:
        text = _q.get()
        state.speaking.set()
        try:
            _speak(text)
        except Exception as e:
            print('  tts error:', e)
        finally:
            time.sleep(0.3)  # let the room echo die before the mic listens again
            if _q.empty():
                state.speaking.clear()


def say(text: str) -> None:
    """Queue text to be spoken. Returns immediately."""
    global _worker
    if not text or not text.strip():
        return
    with _lock:
        if _worker is None:
            _worker = threading.Thread(target=_run, daemon=True, name='tts')
            _worker.start()
    _q.put(text.strip())
