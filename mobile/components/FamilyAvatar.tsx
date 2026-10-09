import { useState } from 'react';
import { Image, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { accentForKey, accents } from '@/lib/accents';
import { cn } from '@/lib/utils';
import type { AccentName } from '@/types';

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Critters avatar, generated from the person's id. Falls back to the
// initials-in-circle look if the request fails (e.g. no internet).
function avatarUri(seed: string, size: number): string {
  return `https://api.dicebear.com/10.x/critters/png?seed=${encodeURIComponent(seed)}&size=${Math.round(size * 2)}`;
}

// Anyone with an id and a name: a hub Person, a User row, or a local member.
// The hub doesn't store a colour, so one is derived from the id and stays the same.
export type Avatarish = { id: number | string; name: string; accent?: AccentName };

export function FamilyAvatar({ member, size = 48 }: { member: Avatarish; size?: number }) {
  const seed = String(member.id);
  const accent = accents[member.accent ?? accentForKey(seed)];
  const [failed, setFailed] = useState(false);

  return (
    <View
      className={cn('items-center justify-center overflow-hidden rounded-full', accent.soft)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <Text className={cn('font-semibold', accent.onSoft)} style={{ fontSize: size * 0.36 }}>
          {initials(member.name)}
        </Text>
      ) : (
        <Image
          source={{ uri: avatarUri(seed, size) }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}
