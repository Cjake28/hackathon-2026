import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Centered card used by the login, register and verify screens.
export function AuthScreen(props: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center p-6"
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{props.title}</CardTitle>
            {props.description && <CardDescription>{props.description}</CardDescription>}
          </CardHeader>
          <CardContent className="gap-4">{props.children}</CardContent>
          {props.footer && (
            <CardFooter className="flex-row justify-center gap-1">{props.footer}</CardFooter>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Field(props: { children: ReactNode }) {
  return <View className="gap-1.5">{props.children}</View>;
}
