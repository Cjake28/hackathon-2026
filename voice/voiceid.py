# OWNER: voice-id. Voice ID: SpeechBrain ECAPA (speechbrain/spkrec-ecapa-voxceleb) + cosine similarity.
# Profiles: config.PROFILES_DIR/<user_id>.npy (git-ignored).
import numpy as np

import config
import hub

_model = None


def _load():
    global _model
    if _model is None:
        from speechbrain.inference.speaker import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy

        # First run downloads into MODELS_DIR; after that load from there (no internet).
        # COPY: Windows can't symlink without admin rights.
        local = config.MODELS_DIR / 'spkrec-ecapa-voxceleb'
        _model = EncoderClassifier.from_hparams(
            source=str(local) if (local / 'embedding_model.ckpt').exists() else 'speechbrain/spkrec-ecapa-voxceleb',
            savedir=str(local),
            run_opts={'device': 'cpu'},
            local_strategy=LocalStrategy.COPY,
        )
    return _model


def embed(audio: np.ndarray) -> np.ndarray:
    """Speaker embedding of 16 kHz float32 audio."""
    import torch

    wav = torch.from_numpy(np.ascontiguousarray(audio, dtype=np.float32)).unsqueeze(0)
    with torch.no_grad():
        v = _load().encode_batch(wav).squeeze().numpy().astype(np.float32)
    return v / (np.linalg.norm(v) + 1e-9)


_names = None


def _name(user_id: int) -> str:
    global _names
    if _names is None:
        try:
            _names = {p['id']: p['name'] for p in hub.get_people()}
        except Exception:
            return str(user_id)  # hub down: retry next time
    return _names.get(user_id, str(user_id))


def scores(audio: np.ndarray) -> dict[int, float]:
    """Cosine score against every saved profile."""
    v = embed(audio)
    out = {}
    for f in config.PROFILES_DIR.glob('*.npy'):
        p = np.load(f)
        out[int(f.stem)] = float(np.dot(v, p) / (np.linalg.norm(p) + 1e-9))
    return out


def identify(audio: np.ndarray) -> tuple[int | None, str | None, float]:
    """(user_id, name, score) of the best profile if score >= config.ID_THRESHOLD, else (None, None, score)."""
    s = scores(audio)
    if not s:
        return None, None, 0.0
    uid = max(s, key=s.get)
    if s[uid] >= config.ID_THRESHOLD:
        return uid, _name(uid), s[uid]
    return None, None, s[uid]
