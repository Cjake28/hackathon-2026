# OWNER: voice-ears. Speech-to-text: ElevenLabs Scribe first (ELEVENLABS_STT=true), local faster-whisper (multilingual small) as fallback.
import io
import threading

import numpy as np
import requests
import soundfile as sf

import config

_whisper = None
_lock = threading.Lock()


def _scribe(audio: np.ndarray) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio, config.SAMPLE_RATE, format='WAV', subtype='PCM_16')
    buf.seek(0)
    r = requests.post(
        'https://api.elevenlabs.io/v1/speech-to-text',
        headers={'xi-api-key': config.ELEVENLABS_API_KEY},
        data={'model_id': 'scribe_v1', 'tag_audio_events': 'false', 'diarize': 'true'},
        files={'file': ('audio.wav', buf, 'audio/wav')},
        timeout=config.ELEVENLABS_TIMEOUT,
    )
    r.raise_for_status()
    body = r.json()
    return _main_speaker(body, audio) or body.get('text', '').strip()


def _main_speaker(body: dict, audio: np.ndarray) -> str:
    """Only the words of the person at the mic. With diarize, Scribe labels who said each word; in a noisy hall the other
    talkers are other speakers, and quieter. Keeps the speaker whose words are loudest in the clip ('' = one speaker)."""
    words = [w for w in body.get('words') or [] if w.get('type') == 'word' and w.get('speaker_id')]
    speakers = {w['speaker_id'] for w in words}
    if len(speakers) < 2:
        return ''

    def loudness(speaker: str) -> float:
        spans = [audio[int(w['start'] * config.SAMPLE_RATE):int(w['end'] * config.SAMPLE_RATE)]
                 for w in words if w['speaker_id'] == speaker]
        samples = np.concatenate([s for s in spans if len(s)] or [np.zeros(1, dtype=np.float32)])
        return float(np.sqrt(np.mean(samples ** 2)))

    main = max(speakers, key=loudness)
    print(f'  [stt: {len(speakers)} speakers, kept the loudest]')
    return ' '.join(w['text'] for w in words if w['speaker_id'] == main).strip()


def _load():
    global _whisper
    with _lock:
        if _whisper is None:
            from faster_whisper import WhisperModel
            _whisper = WhisperModel('small', device='cpu', compute_type='int8')
    return _whisper


def _local(audio: np.ndarray) -> str:
    segments, _ = _load().transcribe(audio, language=None, beam_size=1, vad_filter=True)
    return ' '.join(s.text.strip() for s in segments).strip()


def transcribe(audio: np.ndarray) -> str:
    """Text of the 16 kHz float32 audio. Logs which engine answered."""
    if len(audio) < config.SAMPLE_RATE // 4:
        return ''
    if config.ELEVENLABS_STT and config.ELEVENLABS_API_KEY:
        try:
            text = _scribe(audio)
            print('  [stt: scribe]')
            return text
        except Exception as e:
            print(f'  [stt: scribe failed ({type(e).__name__}), using whisper]')
    text = _local(audio)
    print('  [stt: whisper]')
    return text


threading.Thread(target=_load, daemon=True).start()  # load whisper now, not on the first command
