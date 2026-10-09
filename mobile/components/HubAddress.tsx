import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { DEFAULT_API_URL, hubAddress } from '@/lib/api';

// Settings → "Hub address" (also on the login screen, so a new phone can find the hub).
// At home: leave it empty (home Wi-Fi). Away from home: paste the tunnel address the hub laptop shows
// (https://….trycloudflare.com). It changes every time the tunnel restarts.
export function HubAddress() {
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    hubAddress.get().then((url) => setValue(url === DEFAULT_API_URL ? '' : url));
  }, []);

  const save = async () => {
    setChecking(true);
    setStatus('Checking…');
    if (!(await hubAddress.test(value))) {
      setChecking(false);
      setStatus('No hub answers at that address. Check it, and that the tunnel runs on the hub laptop.');
      return;
    }
    const url = await hubAddress.set(value);
    setChecking(false);
    setStatus(`Connected: ${url}`);
    qc.invalidateQueries(); // reload everything from the hub at its new address
  };

  return (
    <View className="gap-2">
      <Text variant="label">Hub address</Text>
      <Text variant="muted">Empty = home Wi-Fi. Away from home: the tunnel address from the hub laptop.</Text>
      <Input
        testID="hub-address"
        placeholder="https://….trycloudflare.com"
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={setValue}
      />
      <Button testID="hub-address-save" disabled={checking} onPress={save}>
        <Text className="text-primary-foreground">Save</Text>
      </Button>
      {status ? <Text variant="muted">{status}</Text> : null}
    </View>
  );
}
