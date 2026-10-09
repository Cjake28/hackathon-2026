/// <reference types="google.maps" />
import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AdvancedMarker, APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import 'leaflet/dist/leaflet.css';
import { MapPin, Trash2 } from 'lucide-react';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCan } from '@/hooks/useAuth';
import {
  currentPosition,
  useAddPlace,
  useDeletePlace,
  useLocations,
  usePlaces,
  useShareLocation,
} from '@/hooks/useLocation';
import type { FamilyLocation, Place } from '@/types';

// Owner: Brain dev. #51 "Where is Ana?" + #52 safe zones (TEAM-PLAN.md section 9).
// Google Maps when VITE_GOOGLE_MAPS_KEY is set (web/.env), otherwise Leaflet + OpenStreetMap (no key).
export const Route = createFileRoute('/_app/map')({ component: MapPage });

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
const MANILA = { lat: 14.5995, lng: 120.9842 };
const SHARE_KEY = 'share-location';

function MapPage() {
  const can = useCan();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Map</h1>
      {can('location.share') && <ShareCard />}
      {can('location.read') && <FamilyCard />}
    </div>
  );
}

// "Share my location": this phone sends its GPS every 20 s (remembered on this device).
function ShareCard() {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SHARE_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const status = useShareLocation(on);
  const toggle = () => {
    setOn(!on);
    try {
      localStorage.setItem(SHARE_KEY, on ? 'off' : 'on');
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>My location</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button onClick={toggle} variant={on ? 'secondary' : 'default'}>
          <MapPin /> {on ? 'Stop sharing' : 'Share my location'}
        </Button>
        {on && status.error && <span className="text-sm text-destructive">{status.error}</span>}
        {on && !status.error && status.at && (
          <span className="text-sm text-muted-foreground">
            {status.place ? `You're at ${status.place}` : 'Not at a saved place'} · sent{' '}
            {status.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

// Parents: everyone on the map, the safe zones, and "Add place here".
function FamilyCard() {
  const { data: people = [] } = useLocations();
  const { data: places = [] } = usePlaces();
  const deletePlace = useDeletePlace();
  const center = people[0] ?? places[0] ?? MANILA;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Family</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {GOOGLE_KEY ? (
          <GoogleFamilyMap center={center} people={people} places={places} />
        ) : (
          <LeafletFamilyMap center={center} people={people} places={places} />
        )}

        <ul className="space-y-1 text-sm">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center gap-2">
              <span className="font-medium">{p.name}</span>
              <Badge variant={p.place ? 'secondary' : 'outline'}>{p.place ?? 'Away'}</Badge>
              <span className="text-muted-foreground">updated {ago(p.updatedAt)}</span>
            </li>
          ))}
          {!people.length && <li className="text-muted-foreground">Nobody is sharing a location yet.</li>}
        </ul>

        <div className="space-y-2">
          <div className="text-sm font-medium">Places</div>
          <div className="flex flex-wrap gap-2">
            {places.map((p) => (
              <Badge key={p.id} variant="outline" className="gap-1">
                {p.name} · {p.radiusM} m
                <button aria-label={`Delete ${p.name}`} onClick={() => deletePlace.mutate(p.id)}>
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <AddPlaceHere />
        </div>
      </CardContent>
    </Card>
  );
}

// Saves a place at this device's current GPS. Demo: stand at the venue and add "School".
function AddPlaceHere() {
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(150);
  const [busy, setBusy] = useState(false);
  const addPlace = useAddPlace();

  const add = async () => {
    if (!name.trim()) return toast.error('Name the place first');
    setBusy(true);
    try {
      const pos = await currentPosition();
      await addPlace.mutateAsync({ name: name.trim(), lat: pos.coords.latitude, lng: pos.coords.longitude, radiusM: radius });
      toast.success(`Saved ${name.trim()}`);
      setName('');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input className="w-40" placeholder="School" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        className="w-24"
        type="number"
        min={30}
        max={2000}
        value={radius}
        onChange={(e) => setRadius(Number(e.target.value))}
        aria-label="Radius in meters"
      />
      <Button variant="outline" onClick={add} disabled={busy}>
        <MapPin /> Add place here
      </Button>
    </div>
  );
}

type MapProps = { center: { lat: number; lng: number }; people: FamilyLocation[]; places: Place[] };

function GoogleFamilyMap({ center, people, places }: MapProps) {
  return (
    <APIProvider apiKey={GOOGLE_KEY!}>
      <GoogleMap
        defaultCenter={{ lat: center.lat, lng: center.lng }}
        defaultZoom={14}
        mapId="DEMO_MAP_ID"
        gestureHandling="greedy"
        className="h-[420px] w-full overflow-hidden rounded-lg border"
      >
        <PlaceCircles places={places} />
        {places.map((p) => (
          <AdvancedMarker key={`place-${p.id}`} position={{ lat: p.lat, lng: p.lng }}>
            <div className="rounded bg-white/90 px-1 text-xs font-medium text-blue-700">{p.name}</div>
          </AdvancedMarker>
        ))}
        {people.map((p) => (
          <AdvancedMarker key={p.userId} position={{ lat: p.lat, lng: p.lng }} title={p.name}>
            <div className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white shadow">{p.name}</div>
          </AdvancedMarker>
        ))}
      </GoogleMap>
    </APIProvider>
  );
}

// The library has no circle component: draw the safe zones with the Maps API directly.
function PlaceCircles({ places }: { places: Place[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const circles = places.map(
      (p) =>
        new google.maps.Circle({
          map,
          center: { lat: p.lat, lng: p.lng },
          radius: p.radiusM,
          strokeColor: '#2563eb',
          strokeWeight: 2,
          fillColor: '#2563eb',
          fillOpacity: 0.12,
        }),
    );
    return () => circles.forEach((c) => c.setMap(null));
  }, [map, places]);
  return null;
}

function LeafletFamilyMap({ center, people, places }: MapProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={14} className="h-[420px] w-full rounded-lg border">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {places.map((p) => (
        <Circle key={`place-${p.id}`} center={[p.lat, p.lng]} radius={p.radiusM} pathOptions={{ color: '#2563eb' }}>
          <Tooltip permanent direction="center">{p.name}</Tooltip>
        </Circle>
      ))}
      {people.map((p) => (
        <CircleMarker key={p.userId} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: '#dc2626', fillOpacity: 0.9 }}>
          <Tooltip permanent direction="top">{p.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return minutes < 1 ? 'just now' : `${minutes} min ago`;
}
