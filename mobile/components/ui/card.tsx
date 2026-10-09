import { Separator } from '@/components/ui/separator';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Children, Fragment } from 'react';
import { View } from 'react-native';

function Card({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <TextClassContext.Provider value="text-card-foreground">
      <View
        className={cn(
          // Duolingo-style content card: crisp 2px border, no shadow, chunky corners.
          'bg-card flex flex-col gap-6 rounded-3xl border-2 border-border py-6',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

/**
 * Rows inside a Card, divided by a hairline — `divide-y` doesn't render on
 * native, so this inserts an actual `<Separator />` between each row instead.
 * Use in place of a plain `.map(...)` when rows sit directly inside a Card.
 */
function CardList({ children }: { children: React.ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <Separator /> : null}
          {row}
        </Fragment>
      ))}
    </>
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex flex-col gap-1.5 px-6', className)} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {

  return (
    <Text
      ref={ref}
      role="heading"
      aria-level={3}
      className={cn('text-lg font-sans-bold leading-none tracking-[-0.02em]', className)}
      {...props}
    />
  );
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return <Text className={cn('text-muted-foreground text-sm', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex flex-row items-center px-6', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardList, CardTitle };
