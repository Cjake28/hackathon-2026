# OWNER: voice-ears. Wake word: openwakeword "hey_jarvis" (inference_framework="onnx").
import numpy as np

import audio

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
    """Blocks until "hey jarvis" is heard. The following audio.record() continues from the next frame."""
    model = _load()
    model.reset()
    audio.frame()
    audio.flush()  # ignore anything said before we started listening
    print('  say "hey jarvis"...')
    while True:
        frame = audio.frame()  # frames are dropped while Jarvis speaks (audio._on_audio)
        scores = model.predict((frame * 32767).astype(np.int16))
        if max(scores.values()) >= THRESHOLD:
            print('  [wake]')
            model.reset()
            audio.keep_next = True
            return
