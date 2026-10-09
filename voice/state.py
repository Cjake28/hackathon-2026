# Shared runtime state between the mic loop, TTS thread and the HTTP server.
import threading

speaking = threading.Event()  # set while TTS talks -> audio.record() waits / ignores the mic
forced_speaker: int | None = None  # keys 1-5 force the next speaker id, 0 = automatic
last_speaker: str | None = None  # name shown by GET /health
listening = False
