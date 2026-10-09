# OWNER: voice-ears. Mic input (sounddevice, 16 kHz mono). Audio stays in memory, never saved.
import time

import numpy as np
import sounddevice as sd

import config
import state

BLOCK = config.SAMPLE_RATE // 10  # 100 ms
SILENCE_RMS = 0.01  # below this = silence
SILENCE_S = 1.0


def record(max_s: float = 8) -> np.ndarray:
    """Record until ~1 s of silence or max_s. Waits while state.speaking is set. float32, 16 kHz mono."""
    while state.speaking.is_set():
        time.sleep(0.05)
    print('  listening...')
    chunks, quiet, heard = [], 0, False
    with sd.InputStream(samplerate=config.SAMPLE_RATE, channels=1, dtype='float32', blocksize=BLOCK) as stream:
        for _ in range(int(max_s * 10)):
            block, _ = stream.read(BLOCK)
            if state.speaking.is_set():  # Jarvis is talking: ignore the mic
                continue
            block = block[:, 0].copy()
            chunks.append(block)
            if np.sqrt(np.mean(block ** 2)) > SILENCE_RMS:
                heard, quiet = True, 0
            else:
                quiet += 1
                # stop after 1 s of silence once speech started (or 3 s of nothing at all)
                if (heard and quiet >= SILENCE_S * 10) or (not heard and quiet >= 30):
                    break
    return np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
