import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { FloatingBubble } from '@/modules/floating-bubble';

const LABEL = 'Jarvis';
const OPEN_URL = 'hackathon://talk';

// The bubble lives in a window Android owns, not in React, so the switch reads
// its real state back instead of keeping its own.
export function useFloatingBubble() {
  const [floating, setFloating] = useState(() => FloatingBubble.isVisible());
  const wanted = useRef(false);

  // Permission is granted in Android's own settings, so the answer only lands
  // when the user comes back to us.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (wanted.current && FloatingBubble.hasPermission() && !FloatingBubble.isVisible()) {
        wanted.current = false;
        FloatingBubble.show(LABEL, OPEN_URL).then(() => setFloating(true));
        return;
      }
      setFloating(FloatingBubble.isVisible());
    });
    return () => subscription.remove();
  }, []);

  const float = async (next: boolean) => {
    wanted.current = false;
    if (!next) {
      await FloatingBubble.hide();
      setFloating(false);
      return;
    }
    if (!FloatingBubble.supported) {
      Alert.alert(
        'Not on this phone',
        'Jarvis can only sit on top of your home screen on Android. iPhones give apps no way to do it.'
      );
      return;
    }
    if (!FloatingBubble.hasPermission()) {
      wanted.current = true;
      Alert.alert(
        'Let Jarvis sit on top',
        'Android asks for this one by hand. Find Jarvis in the list that opens, turn it on, then come back here.',
        [
          { text: 'Not now', style: 'cancel', onPress: () => { wanted.current = false; } },
          { text: 'Open settings', onPress: () => FloatingBubble.requestPermission() },
        ]
      );
      return;
    }
    await FloatingBubble.show(LABEL, OPEN_URL);
    setFloating(true);
  };

  return { floating, float };
}
