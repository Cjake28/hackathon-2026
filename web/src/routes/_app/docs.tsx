import { useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/useAuth';
import { useAsk, useDeleteDocument, useDocuments, useUploadDocument } from '@/hooks/useDocs';

// RAG: upload documents, then ask questions answered only from them (with sources).
export const Route = createFileRoute('/_app/docs')({ component: DocsPage });

function DocsPage() {
  const can = useCan();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Docs</h1>
      <AskPanel />
      <DocumentsPanel canManage={can('docs.manage')} />
    </div>
  );
}

function AskPanel() {
  const ask = useAsk();
  const [question, setQuestion] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask your docs</CardTitle>
        <CardDescription>Answers come only from the documents below, with sources.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) ask.mutate(question.trim());
          }}
        >
          <Input
            placeholder="e.g. How many vacation days do I get?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button type="submit" disabled={ask.isPending || !question.trim()}>
            {ask.isPending ? 'Thinking…' : 'Ask'}
          </Button>
        </form>

        {ask.data && (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-sm">{ask.data.answer}</p>
            {ask.data.sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Sources</p>
                {ask.data.sources.map((s) => (
                  <div key={s.n} className="rounded-md border p-2 text-xs">
                    <p className="font-medium">
                      [{s.n}] {s.title}
                      {s.page ? ` · page ${s.page}` : ''}
                    </p>
                    <p className="line-clamp-2 text-muted-foreground">{s.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsPanel({ canManage }: { canManage: boolean }) {
  const { data: docs, isLoading } = useDocuments();
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Documents</h2>
        {canManage && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.txt,.md"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  upload.mutate(file, {
                    onSuccess: (doc) => toast.success(`${doc.title}: ${doc.chunks} chunks indexed`),
                  });
                }
                e.target.value = '';
              }}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}>
              <Upload /> {upload.isPending ? 'Indexing…' : 'Upload PDF / TXT / MD'}
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs?.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.title}</TableCell>
                <TableCell>{doc._count.chunks}</TableCell>
                <TableCell>{new Date(doc.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(doc.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {docs?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No documents yet.{canManage ? ' Upload one, or run `npm run rag:ingest`.' : ''}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
