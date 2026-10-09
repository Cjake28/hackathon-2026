import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type Native = {
  hasPermission: () => boolean;
  isVisible: () => boolean;
  requestPermission: () => Promise<void>;
  show: (label: string, url: string) => Promise<void>;
  hide: () => Promise<void>;
};

// Missing in Expo Go and on iOS/web, where there is no overlay API at all.
const native = requireOptionalNativeModule<Native>('FloatingBubble');

export const FloatingBubble = {
  supported: Platform.OS === 'android' && !!native,
  hasPermission: () => native?.hasPermission() ?? false,
  isVisible: () => native?.isVisible() ?? false,
  requestPermission: () => native?.requestPermission() ?? Promise.resolve(),
  show: (label: string, url: string) => native?.show(label, url) ?? Promise.resolve(),
  hide: () => native?.hide() ?? Promise.resolve(),
};
