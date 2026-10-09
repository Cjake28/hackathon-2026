import Markdown from '@ronradtke/react-native-markdown-display';
import { useColorScheme } from 'nativewind';
import { THEME } from '@/lib/theme';

// AI answers are Markdown (bold, lists, tables, code), styled with the app's theme colors.
export function MarkdownText({ children }: { children: string }) {
  const { colorScheme } = useColorScheme();
  const t = THEME[colorScheme ?? 'light'];

  return (
    <Markdown
      style={{
        body: { color: t.foreground, fontSize: 15, lineHeight: 22 },
        paragraph: { marginTop: 2, marginBottom: 2 },
        bullet_list: { marginVertical: 2 },
        ordered_list: { marginVertical: 2 },
        code_inline: { backgroundColor: t.border, color: t.foreground },
        code_block: { backgroundColor: t.border, color: t.foreground },
        fence: { backgroundColor: t.border, color: t.foreground },
        table: { borderColor: t.border },
        tr: { borderColor: t.border },
        link: { color: t.foreground },
      }}
    >
      {children}
    </Markdown>
  );
}
