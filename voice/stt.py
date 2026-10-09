# OWNER: voice-ears. Speech-to-text: ElevenLabs Scribe first, local faster-whisper (multilingual small) as fallback.
import io

import numpy as np
import requests
import soundfile as sf

import config

_whisper = None


def _scribe(audio: np.ndarray) -> str:
    buf = io.BytesIO()
    sf.write(buf, audio, config.SAMPLE_RATE, format='WAV', subtype='PCM_16')
    buf.seek(0)
    r = requests.post(
        'https://api.elevenlabs.io/v1/speech-to-text',
        headers={'xi-api-key': config.ELEVENLABS_API_KEY},
        data={'model_id': 'scribe_v1', 'tag_audio_events': 'false'},
        files={'file': ('audio.wav', buf, 'audio/wav')},
        timeout=config.ELEVENLABS_TIMEOUT,
    )
    r.raise_for_status()
    return r.json().get('text', '').strip()


def _local(audio: np.ndarray) -> str:
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel('small', device='cpu', compute_type='int8')
    segments, _ = _whisper.transcribe(audio, language=None, beam_size=1, vad_filter=True)
    return ' '.join(s.text.strip() for s in segments).strip()


def transcribe(audio: np.ndarray) -> str:
    """Text of the 16 kHz float32 audio. Logs which engine answered."""
    if len(audio) < config.SAMPLE_RATE // 4:
        return ''
    if config.ELEVENLABS_API_KEY:
        try:
            text = _scribe(audio)
            print('  [stt: scribe]')
            return text
        except Exception as e:
            print(f'  [stt: scribe failed ({type(e).__name__}), using whisper]')
    text = _local(audio)
    print('  [stt: whisper]')
    return text
