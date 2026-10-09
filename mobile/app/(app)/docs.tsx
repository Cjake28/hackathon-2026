import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AiStatus } from '@/components/AiStatus';
import { MarkdownText } from '@/components/MarkdownText';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAsk, useDocuments } from '@/hooks/useDocs';

// RAG: ask questions answered only from the uploaded documents (upload them on the web app).
export default function DocsScreen() {
  const ask = useAsk();
  const { data: docs } = useDocuments();
  const [question, setQuestion] = useState('');

  const submit = () => {
    if (question.trim() && !ask.isPending) ask.mutate(question.trim());
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4"
      keyboardShouldPersistTaps="handled"
    >
      <AiStatus />
      <Text className="text-sm text-muted-foreground">
        Answers come only from the {docs?.length ?? 0} uploaded document(s), with sources.
      </Text>
      <View className="flex-row gap-2">
        <Input
          testID="docs-question"
          className="flex-1"
          placeholder="Ask your docs…"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={submit}
        />
        {ask.isPending ? (
          <Button testID="docs-stop" variant="outline" onPress={ask.stop}>
            <Text>Stop</Text>
          </Button>
        ) : (
          <Button testID="docs-ask" onPress={submit} disabled={!question.trim()}>
            <Text>Ask</Text>
          </Button>
        )}
      </View>

      {ask.data && (
        <Card className="gap-3 p-4">
          <MarkdownText>{ask.data.answer || '…'}</MarkdownText>
          {ask.data.sources.map((s) => (
            <View key={s.n} className="gap-1 rounded-md border border-border p-2">
              <Text className="text-xs font-medium">
                [{s.n}] {s.title}
                {s.page ? ` · page ${s.page}` : ''}
              </Text>
              <Text className="text-xs text-muted-foreground" numberOfLines={2}>
                {s.snippet}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
