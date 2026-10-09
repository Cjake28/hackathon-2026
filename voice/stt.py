# OWNER: voice-ears. Speech-to-text: ElevenLabs Scribe first, local faster-whisper (multilingual small) as fallback.
import numpy as np


def transcribe(audio: np.ndarray) -> str:
    """Text of the 16 kHz float32 audio. Logs which engine answered."""
    # STUB
    return 'stub text'
