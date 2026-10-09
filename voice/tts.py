# OWNER: voice-mouth. Text-to-speech on ONE worker thread with a queue (never talks over itself).
# Order: saved clip (clips/ or clips/cache/<sha1>.wav) -> ElevenLabs (saved to clips/cache/) -> Kokoro (local)
# -> pyttsx3 (-> SAPI if pyttsx3 hangs). Sets state.speaking while talking.
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
EL_TIMEOUT = 2  # seconds to wait for ElevenLabs while someone is waiting to hear the answer
EL_MODEL = 'eleven_flash_v2_5'  # live replies: fast + multilingual (Taglish)
PREGEN_MODEL = 'eleven_multilingual_v2'  # pregen clips: best quality, latency doesn't matter
CACHE_DIR = config.CLIPS_DIR / 'cache'  # ElevenLabs replies saved at runtime (git-ignored)

_q: queue.Queue[str] = queue.Queue()
_kokoro = None  # loaded once, on the worker thread
_pyttsx3_q: queue.Queue = queue.Queue()  # pyttsx3 lives on its own thread so a hang can be detected
_pyttsx3_broken = False
_sapi = None  # win32com SAPI.SpVoice, created on the worker thread


def clip_path(text: str, folder=config.CLIPS_DIR):
    return folder / f"{hashlib.sha1(text.strip().lower().encode('utf-8')).hexdigest()}.wav"


def eleven(text: str, timeout: float = config.ELEVENLABS_TIMEOUT, model: str = EL_MODEL) -> np.ndarray:
    """ElevenLabs TTS -> int16 mono samples at EL_RATE. Raises on any error."""
    if not config.ELEVENLABS_API_KEY or not config.ELEVENLABS_VOICE_ID:
        raise RuntimeError('no ElevenLabs key/voice')
    r = requests.post(
        f'https://api.elevenlabs.io/v1/text-to-speech/{config.ELEVENLABS_VOICE_ID}',
        params={'output_format': f'pcm_{EL_RATE}'},
        headers={'xi-api-key': config.ELEVENLABS_API_KEY, 'content-type': 'application/json'},
        json={'text': text, 'model_id': model},
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


def _pyttsx3_loop() -> None:
    import pyttsx3
    engine = pyttsx3.init()
    while True:
        text, done = _pyttsx3_q.get()
        engine.say(text)
        engine.runAndWait()
        done.set()


def _sapi_say(text: str) -> None:
    global _sapi
    if _sapi is None:
        import pythoncom
        import win32com.client
        pythoncom.CoInitialize()
        _sapi = win32com.client.Dispatch('SAPI.SpVoice')
    _sapi.Speak(text)


def _local_voice(text: str) -> None:
    global _pyttsx3_broken
    if not _pyttsx3_broken:
        done = threading.Event()
        _pyttsx3_q.put((text, done))
        if done.wait(5 + 0.15 * len(text)):
            print(f'  [tts: pyttsx3] {text}')
            return
        _pyttsx3_broken = True
        print('  (pyttsx3 hung, switching to SAPI)')
    print(f'  [tts: sapi] {text}')
    _sapi_say(text)


def _speak(text: str) -> None:
    for path in (clip_path(text), clip_path(text, CACHE_DIR)):
        if path.exists():
            data, rate = sf.read(path, dtype='int16')
            print(f'  [tts: clip] {text}')
            return _play(data, rate)
    try:
        samples = eleven(text, EL_TIMEOUT)
        print(f'  [tts: elevenlabs] {text}')
        _play(samples, EL_RATE)
        CACHE_DIR.mkdir(exist_ok=True)
        sf.write(clip_path(text, CACHE_DIR), samples, EL_RATE, subtype='PCM_16')
        return
    except Exception as e:
        print(f'  (elevenlabs skipped: {e})')
    try:
        samples, rate = _load_kokoro().create(text, voice=KOKORO_VOICE, lang='en-us')
        print(f'  [tts: kokoro] {text}')
        return _play(samples, rate)
    except Exception as e:
        print(f'  (kokoro skipped: {e})')
    _local_voice(text)


def _run() -> None:
    try:
        _load_kokoro()  # warm up now (~3 s) so the first offline sentence isn't late
    except Exception as e:
        print(f'  (kokoro not available: {e})')
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
    if text and text.strip():
        _q.put(text.strip())


threading.Thread(target=_run, daemon=True, name='tts').start()
threading.Thread(target=_pyttsx3_loop, daemon=True, name='pyttsx3').start()
