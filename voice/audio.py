# OWNER: voice-ears. Mic input (sounddevice, 16 kHz mono). Audio stays in memory, never saved.
# One mic stream stays open; wake.py and record() read the same 80 ms frames, so nothing is lost between them.
import collections
import queue

import numpy as np
import sounddevice as sd

import config
import state

FRAME = 1280  # 80 ms at 16 kHz (what openwakeword expects)
FRAME_S = FRAME / config.SAMPLE_RATE
SILENCE_RMS = 0.01  # minimum threshold; the real one follows the room's noise floor
NOISE_X = 2.5  # speech = louder than NOISE_X * noise floor
SILENCE_S = 1.0  # stop after this much silence once speech started
# Background talk in a hall never goes silent, so "1 s of silence" never came and every recording ran the full 8 s,
# picking up other people. Once someone is speaking, anything below END_RATIO of their own loudness also counts as
# quiet: they're close to the mic, the room is farther away (TEAM-PLAN, Voice: background voices).
END_RATIO = 0.5
START_S = 5.0  # give up if no speech starts within this

_frames: queue.Queue = queue.Queue(maxsize=int(10 / FRAME_S))  # last ~10 s
_stream = None
_levels = collections.deque(maxlen=int(3 / FRAME_S))  # RMS of the last ~3 s (noise floor)
keep_next = False  # wake.py sets this: the next record() continues right after the wake word


def _on_audio(indata, frames, time_info, status):
    if state.speaking.is_set():  # Jarvis is talking: drop the mic
        return
    if _frames.full():
        try:
            _frames.get_nowait()
        except queue.Empty:
            pass
    block = indata[:, 0].copy()
    _levels.append(float(np.sqrt(np.mean(block ** 2))))
    _frames.put_nowait(block)


def threshold() -> float:
    if len(_levels) < 10:
        return SILENCE_RMS
    return max(SILENCE_RMS, NOISE_X * float(np.percentile(_levels, 20)))


def frame() -> np.ndarray:
    """Next 80 ms float32 frame from the shared mic stream (blocks)."""
    global _stream
    if _stream is None:
        _stream = sd.InputStream(samplerate=config.SAMPLE_RATE, channels=1, dtype='float32',
                                 blocksize=FRAME, callback=_on_audio)
        _stream.start()
    return _frames.get()


def flush() -> None:
    while not _frames.empty():
        try:
            _frames.get_nowait()
        except queue.Empty:
            break


def record(max_s: float = 8) -> np.ndarray:
    """Record until ~1 s of silence or max_s. Waits while state.speaking is set. float32, 16 kHz mono."""
    global keep_next
    if not keep_next:  # push-to-talk: start from now, not from old frames
        frame()
        flush()
    keep_next = False
    level = threshold()
    print('  listening...')
    chunks, quiet, heard, loud, peak = [], 0.0, False, 0, 0.0
    voice: list[float] = []  # loudness of the frames that were speech: how loud this speaker is
    while len(chunks) * FRAME_S < max_s:
        block = frame()
        chunks.append(block)
        rms = float(np.sqrt(np.mean(block ** 2)))
        peak = max(peak, rms)
        # 75th percentile: the speaker's own loud frames, not the background ones caught before they started
        speaking_level = max(level, END_RATIO * float(np.percentile(voice, 75))) if heard else level
        if rms > speaking_level:
            voice.append(rms)
            loud += 1
            heard = heard or loud >= 5  # 0.4 s of sound = speech, not a click or a cough
            quiet = 0.0
        else:
            quiet += FRAME_S
            if quiet >= SILENCE_S:
                if heard:
                    break
                loud = 0  # only a blip: keep waiting
        if not heard and len(chunks) * FRAME_S >= START_S:
            break
    print(f'  recorded {len(chunks) * FRAME_S:.1f} s (peak {peak:.3f}, threshold {level:.3f}{"" if heard else ", heard nothing"})')
    return np.concatenate(chunks) if heard else np.zeros(0, dtype=np.float32)
