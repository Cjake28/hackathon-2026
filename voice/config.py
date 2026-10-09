# Settings from voice/.env. Every module imports from here.
import os
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).parent
load_dotenv(HERE / '.env')

HUB_URL = os.getenv('HUB_URL', 'http://127.0.0.1:4101/api')
HUB_KEY = os.getenv('HUB_KEY', '')
PORT = int(os.getenv('PORT', '4103'))
ID_THRESHOLD = float(os.getenv('ID_THRESHOLD', '0.5'))
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY', '')
ELEVENLABS_VOICE_ID = os.getenv('ELEVENLABS_VOICE_ID', '')
ELEVENLABS_STT = os.getenv('ELEVENLABS_STT', 'true').lower() == 'true'  # true = Scribe first, local whisper when offline; false = recordings never leave the hub
ELEVENLABS_TIMEOUT = 6  # seconds; Scribe needs ~1.7 s for 2 s of audio. On timeout/error fall back to local

SAMPLE_RATE = 16000
PROFILES_DIR = HERE / 'profiles'  # git-ignored
CLIPS_DIR = HERE / 'clips'
MODELS_DIR = HERE / 'models'  # git-ignored (Kokoro etc.)

MOCK = False  # main.py sets this from --mock
