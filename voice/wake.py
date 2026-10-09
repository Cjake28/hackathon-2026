# OWNER: voice-ears. Wake word: openwakeword "hey_jarvis" (inference_framework="onnx").
import time

import numpy as np
import sounddevice as sd

import config
import state

FRAME = 1280  # 80 ms at 16 kHz, what openwakeword expects
THRESHOLD = 0.5
_model = None


def _load():
    global _model
    if _model is None:
        import openwakeword
        from openwakeword.model import Model
        try:
            _model = Model(wakeword_models=['hey_jarvis'], inference_framework='onnx')
        except Exception:  # models not downloaded yet (needs internet once)
            openwakeword.utils.download_models(['hey_jarvis'])
            _model = Model(wakeword_models=['hey_jarvis'], inference_framework='onnx')
    return _model


def wait_for_wake() -> None:
    """Blocks until "hey jarvis" is heard."""
    model = _load()
    model.reset()
    print('  say "hey jarvis"...')
    with sd.InputStream(samplerate=config.SAMPLE_RATE, channels=1, dtype='int16', blocksize=FRAME) as stream:
        while True:
            frame, _ = stream.read(FRAME)
            if state.speaking.is_set():  # don't wake on our own voice
                time.sleep(0.01)
                continue
            scores = model.predict(frame[:, 0].astype(np.int16))
            if max(scores.values()) >= THRESHOLD:
                print('  [wake]')
                model.reset()
                return
