// Distance in meters between two GPS points (haversine). No maps API needed for safe zones.
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// The saved place this point is inside (closest one if several overlap), or null.
export function placeAt<P extends { lat: number; lng: number; radiusM: number }>(point: { lat: number; lng: number }, places: P[]) {
  return (
    places
      .map((p) => ({ p, d: distanceM(point, p) }))
      .filter(({ p, d }) => d <= p.radiusM)
      .sort((a, b) => a.d - b.d)[0]?.p ?? null
  );
}

// "350 m" / "2.4 km"
export const sayDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
