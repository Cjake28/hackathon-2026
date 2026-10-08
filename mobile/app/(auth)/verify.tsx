import { useState } from 'react';
import { Link, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useResendCode, useVerifyEmail } from '@/hooks/useAuth';

// Sign-up step 2: /verify?email=... — enter the 6-digit code from the email.
export default function VerifyScreen() {
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const verify = useVerifyEmail();
  const resend = useResendCode();
  const [code, setCode] = useState('');

  const onChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) verify.mutate({ email, code: digits });
  };

  return (
    <AuthScreen
      title="Check your email"
      description={`Enter the 6-digit code we sent to ${email}.`}
      footer={
        <Link href="/register" asChild>
          <Text className="text-sm font-medium underline">Use a different email</Text>
        </Link>
      }
    >
      <Input
        value={code}
        onChangeText={onChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        className="h-14 text-center text-2xl tracking-[8px]"
      />
      <Button
        onPress={() => verify.mutate({ email, code })}
        disabled={code.length < 6 || verify.isPending}
      >
        <Text>Verify</Text>
      </Button>
      <Button
        variant="ghost"
        disabled={resend.isPending}
        onPress={() =>
          resend.mutate(email, { onSuccess: () => Alert.alert('New code sent', `Check ${email}.`) })
        }
      >
        <Text>Resend code</Text>
      </Button>
    </AuthScreen>
  );
}
