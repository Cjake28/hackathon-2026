// The ringing sound for an alarm, loaded in a way that survives an older build of the app.
//
// expo-audio is a native module: it only exists in an app binary built after it was added. A static
// `import` would crash the whole app on an older install, so it's loaded lazily — the alarm still
// takes over the screen and vibrates, it just doesn't make a noise.

type Player = { loop: boolean; play: () => void; pause: () => void; seekTo: (seconds: number) => void };
type ExpoAudio = { createAudioPlayer: (source: unknown) => Player };

let player: Player | null = null;
let tried = false;

function load() {
  if (tried) return player;
  tried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const audio = require('expo-audio') as ExpoAudio;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    player = audio.createAudioPlayer(require('../assets/alarm.wav'));
    player.loop = true;
  } catch {
    player = null; // built before expo-audio was added
  }
  return player;
}

/** Rings until stopAlarmSound(). Does nothing when the app can't play audio. */
export function startAlarmSound() {
  const sound = load();
  if (!sound) return;
  try {
    sound.seekTo(0);
    sound.play();
  } catch {
    player = null;
  }
}

export function stopAlarmSound() {
  try {
    player?.pause();
  } catch {
    player = null;
  }
}
