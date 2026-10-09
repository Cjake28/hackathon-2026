// Optional Google Maps calls from the hub (TEAM-PLAN.md section 9). GOOGLE_MAPS_KEY in api/.env.
// No key, no internet or an error → null, and callers fall back to saved places + straight-line distance.

const KEY = () => process.env.GOOGLE_MAPS_KEY;
const TIMEOUT = 3000;

type Point = { lat: number; lng: number };

// "SM Megamall, Mandaluyong" (the first two parts of Google's address).
export async function placeName(p: Point): Promise<string | null> {
  if (!KEY()) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${p.lat},${p.lng}&key=${KEY()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    const body = (await res.json()) as { results?: { formatted_address: string }[] };
    const address = body.results?.[0]?.formatted_address;
    return address ? address.split(',').slice(0, 2).join(',').trim() : null;
  } catch {
    return null;
  }
}

// Driving time in minutes (Routes API), e.g. for "Ana will be home in 15 minutes" (#57).
export async function driveMinutes(from: Point, to: Point): Promise<number | null> {
  if (!KEY()) return null;
  const latLng = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': KEY()!,
        'X-Goog-FieldMask': 'routes.duration',
      },
      body: JSON.stringify({ origin: latLng(from), destination: latLng(to), travelMode: 'DRIVE' }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const body = (await res.json()) as { routes?: { duration?: string }[] };
    const seconds = parseInt(body.routes?.[0]?.duration ?? '', 10); // "1234s"
    return Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null;
  } catch {
    return null;
  }
}
