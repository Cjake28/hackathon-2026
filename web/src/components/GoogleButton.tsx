import { GoogleLogin } from '@react-oauth/google';
import { toast } from 'sonner';
import { useGoogleSignIn } from '@/hooks/useAuth';

const googleEnabled = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

// "Continue with Google" plus an "or" divider. Hidden until VITE_GOOGLE_CLIENT_ID is set in web/.env.
export function GoogleButton() {
  const googleSignIn = useGoogleSignIn();
  if (!googleEnabled) return null;

  return (
    <>
      <div className="flex justify-center">
        <GoogleLogin
          text="continue_with"
          width={320}
          onSuccess={({ credential }) => credential && googleSignIn.mutate({ credential })}
          onError={() => toast.error('Google sign-in failed')}
        />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
