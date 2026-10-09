import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AiStatus } from '@/components/AiStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiModels, useSetAiModel } from '@/hooks/useAi';

// Admins pick which downloaded model answers everyone (saved on the hub). Download more with `ollama pull <model>`.
export const Route = createFileRoute('/_app/ai-settings')({ component: AiSettingsPage });

function AiSettingsPage() {
  const { data: models, isLoading } = useAiModels();
  const setModel = useSetAiModel();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">AI Settings</h1>
        <AiStatus />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Chat model</CardTitle>
          <CardDescription>
            Used for every chat, document answer and AI feature. Bigger models are smarter but slower and need
            more memory. Download more on the hub with <code>ollama pull &lt;model&gt;</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <Skeleton className="h-24 w-full" />}
          {models?.map((m) => (
            <div key={m.name} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
              <span className="font-medium">{m.name}</span>
              <span className="text-sm text-muted-foreground">{m.sizeGb} GB</span>
              {m.capabilities
                .filter((c) => c !== 'completion')
                .map((c) => (
                  <Badge key={c} variant="secondary">
                    {c}
                  </Badge>
                ))}
              <div className="ml-auto">
                {m.active ? (
                  <Badge>In use</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setModel.isPending}
                    onClick={() =>
                      setModel.mutate(m.name, { onSuccess: () => toast.success(`Now using ${m.name}. Loading it…`) })
                    }
                  >
                    Use this
                  </Button>
                )}
              </div>
            </div>
          ))}
          {models?.length === 0 && (
            <p className="text-sm text-muted-foreground">No chat models downloaded. On the hub: ollama pull qwen3.5:2b</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
