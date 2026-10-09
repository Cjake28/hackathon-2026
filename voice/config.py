# Settings from voice/.env. Every module imports from here.
import os
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).parent
load_dotenv(HERE / '.env')

HUB_URL = os.getenv('HUB_URL', 'http://127.0.0.1:4101/api')
HUB_KEY = os.getenv('HUB_KEY', '')
PORT = int(os.getenv('PORT', '4103'))
ID_THRESHOLD = float(os.getenv('ID_THRESHOLD', '0.6'))
ELEVENLABS_API_KEY = os.getenv('ELEVENLABS_API_KEY', '')
ELEVENLABS_VOICE_ID = os.getenv('ELEVENLABS_VOICE_ID', '')
ELEVENLABS_TIMEOUT = 3  # seconds; on timeout/error fall back to the local option

SAMPLE_RATE = 16000
PROFILES_DIR = HERE / 'profiles'  # git-ignored
CLIPS_DIR = HERE / 'clips'
MODELS_DIR = HERE / 'models'  # git-ignored (Kokoro etc.)

MOCK = False  # main.py sets this from --mock
