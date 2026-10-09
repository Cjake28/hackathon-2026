# OWNER: voice-ears. Mic input (sounddevice, 16 kHz mono). Audio stays in memory, never saved.
import numpy as np

import config
import state


def record(max_s: float = 8) -> np.ndarray:
    """Record until ~1 s of silence or max_s. Waits while state.speaking is set. float32, 16 kHz mono."""
    # STUB: returns 1 s of silence
    return np.zeros(config.SAMPLE_RATE, dtype=np.float32)
