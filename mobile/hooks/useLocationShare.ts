import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useCan } from '@/hooks/useAuth';
import { usePreferencesStore } from '@/hooks/usePreferences';
import { api } from '@/lib/api';
import { NEEDS_REBUILD, askForLocation, hasLocation, watchLocation, type LocationWatcher } from '@/lib/location';

// This phone telling the hub where it is (#51, #52). The position goes to the hub on the home
// Wi-Fi and nowhere else; when it lands inside a place the hub knows ("Home", "School") the
// parents' phones get "Ana arrived at School".
//
// Only while the app is open — no background tracking.

const EVERY_MS = 20_000;
const MIN_MOVE_M = 25;

type ShareState = {
  allowed: boolean | null; // null = not asked yet
  place: string | null; // the named spot the hub matched, if any
  error: string | null;
  set: (next: Partial<Omit<ShareState, 'set'>>) => void;
};

// Shared so the Settings screen shows what the app-wide watcher is doing.
const useShareState = create<ShareState>((set) => ({
  allowed: null,
  place: null,
  error: null,
  set: (next) => set(next),
}));

const OFF_MESSAGE = 'Location is turned off for this app. Turn it on in your phone settings.';

/** Runs the watcher. Mounted once, app-wide (components/HubListener.tsx). */
export function useLocationSharing() {
  const can = useCan();
  const on = usePreferencesStore((s) => s.shareLocation);
  const set = useShareState((s) => s.set);
  const watcher = useRef<LocationWatcher | null>(null);

  const wanted = on && can('location.share');

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      watcher.current?.remove();
      watcher.current = null;
    };

    const start = async () => {
      if (!hasLocation()) {
        set({ allowed: false, error: NEEDS_REBUILD });
        return;
      }
      const granted = await askForLocation();
      if (cancelled) return;
      set({ allowed: granted, error: granted ? null : OFF_MESSAGE });
      if (!granted) return;
      const subscription = await watchLocation({ everyMs: EVERY_MS, minMoveM: MIN_MOVE_M }, async (coords) => {
        // The hub may be out of reach for a moment; keep watching quietly.
        const res = await api
          .post<{ place: string | null }>('/location', {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy ?? undefined,
          })
          .catch(() => null);
        if (res) set({ place: res.place });
      });
      if (cancelled) subscription?.remove();
      else watcher.current = subscription;
    };

    if (wanted) void start();
    else {
      stop();
      set({ place: null, error: null });
    }

    return () => {
      cancelled = true;
      stop();
    };
  }, [wanted, set]);
}

/** What the UI needs: whether it's on, what the hub matched, and the switch. */
export function useShareLocation() {
  const can = useCan();
  const on = usePreferencesStore((s) => s.shareLocation);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const { allowed, place, error } = useShareState();

  return {
    state: { on: on && can('location.share'), allowed, place, error, supported: hasLocation() },
    setOn: (next: boolean) => setPreference('shareLocation', next),
  };
}
