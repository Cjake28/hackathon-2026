/** "5 min" / "2 hours" style relative time, for "last seen" rows. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** "06:30" (24h, hub time) as "6:30 am". */
export function formatTime(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** How often a hub alarm repeats, in words. */
export function describeRepeat(repeat: 'once' | 'daily' | 'weekdays'): string {
  if (repeat === 'daily') return 'Every day';
  if (repeat === 'weekdays') return 'Weekdays';
  return 'Once';
}
