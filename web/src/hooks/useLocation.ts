import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { FamilyLocation, Place } from '@/types';

// Everyone's last location (parents). Refreshes every 5 s for the live map.
export const useLocations = () =>
  useQuery({ queryKey: ['locations'], queryFn: () => api.get<FamilyLocation[]>('/location'), refetchInterval: 5000 });

export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: () => api.get<Place[]>('/places') });

export const useAddPlace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; lat: number; lng: number; radiusM: number }) => api.post<Place>('/places', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['places'] }),
  });
};

export const useDeletePlace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<Place>(`/places/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['places'] }),
  });
};

// This device's GPS once. Browsers only allow it on HTTPS (open the hub through the tunnel link) or localhost.
export function currentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser has no GPS'));
    if (!window.isSecureContext) return reject(new Error('GPS needs HTTPS: open the hub through the tunnel link'));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.message)), {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 10_000,
    });
  });
}

// While `on`, sends this phone's GPS to the hub every 20 s. Returns the saved place it's at, or an error.
export function useShareLocation(on: boolean) {
  const [state, setState] = useState<{ place?: string | null; error?: string; at?: Date }>({});
  useEffect(() => {
    if (!on) return;
    const send = () =>
      currentPosition()
        .then((pos) =>
          api.post<{ place: string | null }>('/location', {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          }),
        )
        .then((res) => setState({ place: res.place, at: new Date() }))
        .catch((e: Error) => setState({ error: e.message }));
    void send();
    const timer = setInterval(send, 20_000);
    return () => clearInterval(timer);
  }, [on]);
  return state;
}
