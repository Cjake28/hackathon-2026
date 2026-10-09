import { Bus, ForkKnife, Lightning, Student, Wallet } from 'phosphor-react-native';
import { ScrollView, View } from 'react-native';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { accents } from '@/lib/accents';
import { cn } from '@/lib/utils';
import type { AccentName, Expense, ExpenseCategory } from '@/types';

const MONTHLY_LIMIT = 25_000;

// Read-only for now: the hub adds these by voice ("Hey Jarvis, 450 for groceries").
const EXPENSES: Expense[] = [
  { id: 'x-1', amount: 1850, category: 'food', note: 'Weekly market run', addedBy: 'Mom', spentAt: '2026-10-09T10:20:00.000Z' },
  { id: 'x-2', amount: 3200, category: 'bills', note: 'Electricity', addedBy: 'Dad', spentAt: '2026-10-08T14:00:00.000Z' },
  { id: 'x-3', amount: 640, category: 'transport', note: 'Jeepney + grab', addedBy: 'Mom', spentAt: '2026-10-08T07:45:00.000Z' },
  { id: 'x-4', amount: 1200, category: 'school', note: "Ana's project materials", addedBy: 'Mom', spentAt: '2026-10-07T16:30:00.000Z' },
  { id: 'x-5', amount: 920, category: 'food', note: 'Dinner out', addedBy: 'Dad', spentAt: '2026-10-06T19:10:00.000Z' },
  { id: 'x-6', amount: 380, category: 'other', note: 'Load', addedBy: 'Ben', spentAt: '2026-10-05T11:00:00.000Z' },
];

const CATEGORIES: Record<ExpenseCategory, { label: string; icon: React.ComponentProps<typeof Icon>['as']; accent: AccentName }> = {
  food: { label: 'Food', icon: ForkKnife, accent: 'amber' },
  bills: { label: 'Bills', icon: Lightning, accent: 'violet' },
  school: { label: 'School', icon: Student, accent: 'azure' },
  transport: { label: 'Transport', icon: Bus, accent: 'teal' },
  other: { label: 'Other', icon: Wallet, accent: 'rose' },
};

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' });

export default function BudgetScreen() {
  const total = EXPENSES.reduce((sum, expense) => sum + expense.amount, 0);
  const left = MONTHLY_LIMIT - total;
  const usedPct = Math.min(100, Math.round((total / MONTHLY_LIMIT) * 100));

  const byCategory = (Object.keys(CATEGORIES) as ExpenseCategory[])
    .map((key) => ({
      key,
      total: EXPENSES.filter((expense) => expense.category === key).reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Budget" subtitle="This month" back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="items-center gap-3 py-8">
          <Text variant="muted">Spent this month</Text>
          <Text variant="h2" className="pb-0">{PESO.format(total)}</Text>
          <Badge className={cn(left >= 0 ? 'bg-success-soft' : 'bg-destructive-soft')}>
            <Text className={left >= 0 ? 'text-success' : 'text-destructive'}>
              {left >= 0 ? `${PESO.format(left)} left` : `${PESO.format(Math.abs(left))} over`}
            </Text>
          </Badge>

          <View className="w-full gap-1.5 px-6 pt-2">
            <View className="h-3 w-full overflow-hidden rounded-full bg-sunken">
              <View
                className={cn('h-full rounded-full', left >= 0 ? 'bg-primary' : 'bg-destructive')}
                style={{ width: `${usedPct}%` }}
              />
            </View>
            <View className="flex-row justify-between">
              <Text variant="small" className="text-muted-foreground">{usedPct}% used</Text>
              <Text variant="small" className="text-muted-foreground">Limit {PESO.format(MONTHLY_LIMIT)}</Text>
            </View>
          </View>
        </Card>

        <View className="gap-2">
          <Text variant="label">Where it went</Text>
          <Card className="p-4">
            <CardList>
              {byCategory.map((row) => {
                const meta = CATEGORIES[row.key];
                const tone = accents[meta.accent];
                return (
                  <View key={row.key} className="flex-row items-center gap-3 py-2.5">
                    <View className={cn('h-10 w-10 items-center justify-center rounded-full', tone.soft)}>
                      <Icon as={meta.icon} weight="fill" size={20} className={tone.onSoft} />
                    </View>
                    <Text className="flex-1 font-medium">{meta.label}</Text>
                    <Text className="font-sans-bold">{PESO.format(row.total)}</Text>
                  </View>
                );
              })}
            </CardList>
          </Card>
        </View>

        <View className="gap-2">
          <Text variant="label">Recent</Text>
          <Card className="p-4">
            <CardList>
              {EXPENSES.map((expense) => {
                const by = { id: expense.addedBy, name: expense.addedBy };
                const meta = CATEGORIES[expense.category];
                return (
                  <View key={expense.id} className="flex-row items-center gap-3 py-2.5">
                    <FamilyAvatar member={by} size={36} />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>{expense.note || meta.label}</Text>
                      <Text variant="muted" numberOfLines={1}>
                        {meta.label} · {DATE.format(new Date(expense.spentAt))}
                      </Text>
                    </View>
                    <Text className="font-sans-bold">{PESO.format(expense.amount)}</Text>
                  </View>
                );
              })}
            </CardList>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
