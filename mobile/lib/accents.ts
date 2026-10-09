import type { AccentName } from '@/types';

// Six instrument channels (ARC_LIGHT) — each family member/device wears one
// hue everywhere via `accents[name]`, matching the reference theme's ACCENTS.
export const ACCENT_NAMES: AccentName[] = ['arc', 'azure', 'teal', 'amber', 'violet', 'rose'];

export const accents: Record<AccentName, { soft: string; onSoft: string; base: string }> = {
  arc: { soft: 'bg-accent-arc-soft', onSoft: 'text-accent-arc-onSoft', base: 'bg-accent-arc-base' },
  azure: { soft: 'bg-accent-azure-soft', onSoft: 'text-accent-azure-onSoft', base: 'bg-accent-azure-base' },
  teal: { soft: 'bg-accent-teal-soft', onSoft: 'text-accent-teal-onSoft', base: 'bg-accent-teal-base' },
  amber: { soft: 'bg-accent-amber-soft', onSoft: 'text-accent-amber-onSoft', base: 'bg-accent-amber-base' },
  violet: { soft: 'bg-accent-violet-soft', onSoft: 'text-accent-violet-onSoft', base: 'bg-accent-violet-base' },
  rose: { soft: 'bg-accent-rose-soft', onSoft: 'text-accent-rose-onSoft', base: 'bg-accent-rose-base' },
};

/** Stable hue for an arbitrary id, so an entity keeps one colour without storing it. */
export function accentForKey(key: string): AccentName {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 1_000_000;
  return ACCENT_NAMES[hash % ACCENT_NAMES.length];
}
