# OWNER: voice-id. Voice ID: SpeechBrain ECAPA (speechbrain/spkrec-ecapa-voxceleb) + cosine similarity.
# Profiles: config.PROFILES_DIR/<user_id>.npy (git-ignored).
import numpy as np


def embed(audio: np.ndarray) -> np.ndarray:
    """Speaker embedding of 16 kHz float32 audio."""
    # STUB
    return np.zeros(192, dtype=np.float32)


def identify(audio: np.ndarray) -> tuple[int | None, str | None, float]:
    """(user_id, name, score) of the best profile if score >= config.ID_THRESHOLD, else (None, None, score)."""
    # STUB: always guest
    return None, None, 0.0
