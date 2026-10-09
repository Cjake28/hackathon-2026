import type { Capability, Role } from '@/types';

// The single permission table: the voice assistant gates an intent on a
// capability, and screens gate a button on the same capability, so a role
// change moves both at once. See `can()`.
const GRANTS: Record<Role, readonly Capability[]> = {
  parent: [
    'ask',
    'ownAlarms',
    'othersAlarms',
    'ownTasks',
    'assignTasks',
    'reviewChores',
    'network',
    'location',
    'smartHome',
    'cameras',
    'hubAdmin',
  ],
  child: ['ask', 'ownAlarms', 'ownTasks', 'smartHome'],
  guest: ['ask'],
};

export function can(role: Role, capability: Capability): boolean {
  return GRANTS[role].includes(capability);
}

export function capabilitiesFor(role: Role): readonly Capability[] {
  return GRANTS[role];
}

export const ROLE_LABELS: Record<Role, string> = {
  parent: 'Parent',
  child: 'Child',
  guest: 'Guest',
};

export const ROLE_BLURBS: Record<Role, string> = {
  parent: 'Can do everything, including set the rules for everyone else.',
  child: 'Can ask questions, set their own alarms and do their own tasks.',
  guest: 'Can ask the time and the weather. Nothing else.',
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  ask: 'Ask questions',
  ownAlarms: 'Set their own alarms',
  othersAlarms: 'Set alarms for others',
  ownTasks: 'Do their own tasks',
  assignTasks: 'Give out tasks',
  reviewChores: 'Check finished chores',
  network: 'Change internet rules',
  location: 'Ask where someone is',
  smartHome: 'Control lights and appliances',
  cameras: 'See the cameras',
  hubAdmin: 'Change hub settings',
};
