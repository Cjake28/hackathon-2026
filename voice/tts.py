# OWNER: voice-mouth. Text-to-speech on ONE worker thread with a queue (never talks over itself).
# Order: cached clip (clips/<sha1>.wav) -> ElevenLabs -> Kokoro (local) -> pyttsx3. Sets state.speaking while talking.


def say(text: str) -> None:
    """Queue text to be spoken. Returns immediately."""
    # STUB
    print(f'  (stub say) {text}')
