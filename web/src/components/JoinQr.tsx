import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

// "Open on another device": the hub's local network address as a QR code (made in the browser, no internet).
export function JoinQr() {
  const { data } = useQuery({ queryKey: ['hub'], queryFn: () => api.get<{ ips: string[] }>('/hub') });
  const port = window.location.port ? `:${window.location.port}` : '';
  const url = data?.ips[0] ? `http://${data.ips[0]}${port}` : null;
  const { data: svg } = useQuery({
    queryKey: ['qr', url],
    queryFn: () => QRCode.toString(url!, { type: 'svg', margin: 1 }),
    enabled: !!url,
  });

  if (!url) return null;

  return (
    <Card className="w-fit">
      <CardHeader>
        <CardTitle>Open on another device</CardTitle>
        <CardDescription>Same Wi-Fi as this computer. Scan with a phone camera.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {svg && (
          <div className="size-44 rounded-md bg-white p-2" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        <p className="font-mono text-sm">{url}</p>
      </CardContent>
    </Card>
  );
}
