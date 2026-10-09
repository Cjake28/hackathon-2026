# OWNER: voice-mouth. HTTP on config.PORT (4103): POST /speak {text} -> tts.say -> {ok:true};
# GET /health -> {ok, listening, lastSpeaker}.


def start() -> None:
    """Start the server in a background thread. Returns immediately."""
    # STUB
    print('(stub server) not started')
