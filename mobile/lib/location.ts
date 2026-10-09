// The phone's GPS, asked for in a way that survives an older build of the app.
//
// expo-location is a native module: it only exists in an app binary built after it was added.
// A static `import` would crash the whole app on an older install, so it's loaded lazily and
// the location features simply switch themselves off when it isn't there.

export type Coords = { latitude: number; longitude: number; accuracy: number | null };
export type LocationWatcher = { remove: () => void };

type ExpoLocation = {
  Accuracy: { Balanced: number };
  requestForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  getCurrentPositionAsync: (opts: { accuracy: number }) => Promise<{ coords: Coords }>;
  watchPositionAsync: (
    opts: { accuracy: number; timeInterval: number; distanceInterval: number },
    onFix: (fix: { coords: Coords }) => void,
  ) => Promise<LocationWatcher>;
};

let loaded: ExpoLocation | undefined;
let tried = false;

function load() {
  if (!tried) {
    tried = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      loaded = require('expo-location') as ExpoLocation;
    } catch {
      loaded = undefined; // built before expo-location was added
    }
  }
  return loaded;
}

/** False on an app build that predates expo-location: hide or disable the location features. */
export const hasLocation = () => {
  const api = load();
  if (!api) return false;
  // Touching a property is enough to find out whether the native side is really there.
  try {
    return typeof api.requestForegroundPermissionsAsync === 'function';
  } catch {
    loaded = undefined;
    return false;
  }
};

export const NEEDS_REBUILD = 'This version of the app can’t read the phone’s location yet. Reinstall it to use this.';

// Each call is guarded as well as the import: depending on the Expo version the missing
// native module complains at load time or on first use.

export async function askForLocation(): Promise<boolean> {
  const api = load();
  if (!api) return false;
  try {
    const { granted } = await api.requestForegroundPermissionsAsync();
    return granted;
  } catch {
    loaded = undefined;
    return false;
  }
}

export async function currentLocation(): Promise<Coords | null> {
  const api = load();
  if (!api) return null;
  try {
    const { coords } = await api.getCurrentPositionAsync({ accuracy: api.Accuracy.Balanced });
    return coords;
  } catch {
    return null;
  }
}

export async function watchLocation(
  opts: { everyMs: number; minMoveM: number },
  onFix: (coords: Coords) => void,
): Promise<LocationWatcher | null> {
  const api = load();
  if (!api) return null;
  try {
    return await api.watchPositionAsync(
      { accuracy: api.Accuracy.Balanced, timeInterval: opts.everyMs, distanceInterval: opts.minMoveM },
      ({ coords }) => onFix(coords),
    );
  } catch {
    return null;
  }
}
