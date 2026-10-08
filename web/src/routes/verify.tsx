import { useState } from 'react';
import { Link, Navigate, createFileRoute } from '@tanstack/react-router';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { toast } from 'sonner';
import { AuthCard } from '@/components/AuthCard';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useMe, useResendCode, useVerifyEmail } from '@/hooks/useAuth';

// Sign-up step 2: /verify?email=... — enter the 6-digit code from the email.
export const Route = createFileRoute('/verify')({
  validateSearch: (search: Record<string, unknown>) => ({ email: String(search.email ?? '') }),
  component: VerifyPage,
});

function VerifyPage() {
  const { email } = Route.useSearch();
  const { data: user } = useMe();
  const verify = useVerifyEmail();
  const resend = useResendCode();
  const [code, setCode] = useState('');

  if (user) return <Navigate to="/" />;

  return (
    <AuthCard
      title="Check your email"
      description={`Enter the 6-digit code we sent to ${email}.`}
      footer={
        <Link to="/register" className="underline">
          Use a different email
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          verify.mutate({ email, code });
        }}
      >
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            onChange={setCode}
            onComplete={(value: string) => verify.mutate({ email, code: value })}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button type="submit" className="w-full" disabled={code.length < 6 || verify.isPending}>
          Verify
        </Button>
      </form>
      <Button
        variant="link"
        className="w-full"
        disabled={resend.isPending}
        onClick={() => resend.mutate(email, { onSuccess: () => toast.success('New code sent') })}
      >
        Resend code
      </Button>
    </AuthCard>
  );
}
