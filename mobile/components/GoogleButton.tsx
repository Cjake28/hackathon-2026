import { Alert, Platform, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useGoogleSignIn } from '@/hooks/useAuth';

// Native Google sign-in needs a development build (`npx expo run:android` / EAS), not Expo Go,
// plus EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env. Until then this button is hidden.
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin').GoogleSignin;
let GoogleSignin: GoogleSigninModule | null = null;
try {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch {
  // Expo Go: the native module isn't there.
}

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const enabled = !!GoogleSignin && !!webClientId && Platform.OS !== 'web';
if (enabled) {
  GoogleSignin!.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  });
}

export function GoogleButton() {
  const googleSignIn = useGoogleSignIn();
  if (!enabled) return null;

  const signIn = async () => {
    await GoogleSignin!.hasPlayServices();
    const result = await GoogleSignin!.signIn();
    const credential = result.type === 'success' ? result.data.idToken : null;
    if (credential) googleSignIn.mutate({ credential });
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={googleSignIn.isPending}
        onPress={() =>
          signIn().catch((error) => Alert.alert('Google sign-in failed', String(error?.message ?? error)))
        }
      >
        <Text>Continue with Google</Text>
      </Button>
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    </>
  );
}
