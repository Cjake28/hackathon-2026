import { Bus, ForkKnife, Lightning, Plus, Student, Trash, Wallet } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useBudgetSummary, useCreateExpense, useDeleteExpense, useExpenses, useHubFamily } from '@/hooks/useHub';
import { accents } from '@/lib/accents';
import { cn } from '@/lib/utils';
import type { AccentName, ExpenseCategory } from '@/types';
import { useRefresher } from '@/components/Refresher';

const CATEGORIES: Record<
  ExpenseCategory,
  { label: string; icon: React.ComponentProps<typeof Icon>['as']; accent: AccentName }
> = {
  food: { label: 'Food', icon: ForkKnife, accent: 'amber' },
  bills: { label: 'Bills', icon: Lightning, accent: 'violet' },
  school: { label: 'School', icon: Student, accent: 'azure' },
  transport: { label: 'Transport', icon: Bus, accent: 'teal' },
  other: { label: 'Other', icon: Wallet, accent: 'rose' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES) as ExpenseCategory[];

// Onai can file something under a word of its own ("medicine"); show it as Other.
const meta = (category: string) => CATEGORIES[category as ExpenseCategory] ?? CATEGORIES.other;
const labelFor = (category: string) =>
  CATEGORIES[category as ExpenseCategory]?.label ?? category.charAt(0).toUpperCase() + category.slice(1);

const PESO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short' });

// What the house has spent this month. The hub keeps the running total and the
// limit, so every phone sees the same number and Onai can add to it by voice.
export default function BudgetScreen() {
  const refresher = useRefresher();
  const can = useCan();
  const { data: expenses = [] } = useExpenses();
  const { data: summary } = useBudgetSummary();
  const { data: people = [] } = useHubFamily();
  const remove = useDeleteExpense();

  const [adding, setAdding] = useState(false);

  const total = summary?.total ?? 0;
  const limit = summary?.limit ?? null;
  const left = limit === null ? null : limit - total;
  const usedPct = limit ? Math.min(100, Math.round((total / limit) * 100)) : 0;
  const over = left !== null && left < 0;

  const byCategory = Object.entries(summary?.byCategory ?? {})
    .map(([key, amount]) => ({ key, total: amount }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);

  const addedBy = (userId: number) => people.find((p) => p.id === userId);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Budget" subtitle="This month" back />

      <ScrollView refreshControl={refresher} className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card className="items-center gap-3 py-8">
          <Text variant="muted">Spent this month</Text>
          <Text variant="h2" className="pb-0">
            {PESO.format(total)}
          </Text>
          {left === null ? (
            <Badge variant="secondary">
              <Text>No limit set</Text>
            </Badge>
          ) : (
            <Badge className={cn(over ? 'bg-destructive-soft' : 'bg-success-soft')}>
              <Text className={over ? 'text-destructive' : 'text-success'}>
                {over ? `${PESO.format(Math.abs(left))} over` : `${PESO.format(left)} left`}
              </Text>
            </Badge>
          )}

          {limit === null ? null : (
            <View className="w-full gap-1.5 px-6 pt-2">
              <View className="h-3 w-full overflow-hidden rounded-full bg-sunken">
                <View
                  className={cn('h-full rounded-full', over ? 'bg-destructive' : 'bg-primary')}
                  style={{ width: `${usedPct}%` }}
                />
              </View>
              <View className="flex-row justify-between">
                <Text variant="small" className="text-muted-foreground">
                  {usedPct}% used
                </Text>
                <Text variant="small" className="text-muted-foreground">
                  Limit {PESO.format(limit)}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {can('budget.use') ? (
          adding ? (
            <NewExpense onDone={() => setAdding(false)} />
          ) : (
            <Button testID="expense-add" variant="secondary" onPress={() => setAdding(true)}>
              <Icon as={Plus} size={20} />
              <Text>Add what you spent</Text>
            </Button>
          )
        ) : null}

        {expenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nothing spent yet"
            subtitle={'Say "Hey Onai, 450 for groceries" and it\'ll show up here.'}
          />
        ) : null}

        {byCategory.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">Where it went</Text>
            <Card className="p-4">
              <CardList>
                {byCategory.map((row) => {
                  const tone = accents[meta(row.key).accent];
                  return (
                    <View key={row.key} className="flex-row items-center gap-3 py-2.5">
                      <View className={cn('h-10 w-10 items-center justify-center rounded-full', tone.soft)}>
                        <Icon as={meta(row.key).icon} weight="fill" size={20} className={tone.onSoft} />
                      </View>
                      <Text className="flex-1 font-medium">{labelFor(row.key)}</Text>
                      <Text className="font-sans-bold">{PESO.format(row.total)}</Text>
                    </View>
                  );
                })}
              </CardList>
            </Card>
          </View>
        ) : null}

        {expenses.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">Recent</Text>
            <Card className="p-4">
              <CardList>
                {expenses.map((expense) => {
                  const by = addedBy(expense.addedById);
                  return (
                    <View key={expense.id} className="flex-row items-center gap-3 py-2.5">
                      <FamilyAvatar member={by ?? { id: expense.addedById, name: '?' }} size={36} />
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium" numberOfLines={1}>
                          {expense.note || labelFor(expense.category)}
                        </Text>
                        <Text variant="muted" numberOfLines={1}>
                          {labelFor(expense.category)} · {DATE.format(new Date(expense.spentAt))}
                        </Text>
                      </View>
                      <Text className="font-sans-bold">{PESO.format(expense.amount)}</Text>
                      {can('budget.use') ? (
                        <Pressable
                          testID={`expense-delete-${expense.id}`}
                          hitSlop={10}
                          onPress={() => remove.mutate(expense.id)}
                        >
                          <Icon as={Trash} size={18} className="text-destructive" />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </CardList>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function NewExpense({ onDone }: { onDone: () => void }) {
  const create = useCreateExpense();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [note, setNote] = useState('');

  const pesos = Number(amount.replace(/[^\d.]/g, ''));
  const valid = pesos > 0;

  const save = () => {
    if (!valid) return;
    create.mutate({ amount: pesos, category, note: note.trim() || undefined }, { onSuccess: onDone });
  };

  return (
    <Card className="gap-3 p-4">
      <Text variant="label">What you spent</Text>

      <Input
        testID="expense-amount"
        placeholder="How much, in pesos (e.g. 450)"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <View className="flex-row flex-wrap gap-2">
        {CATEGORY_KEYS.map((key) => (
          <Button
            key={key}
            testID={`expense-category-${key}`}
            variant={category === key ? 'default' : 'secondary'}
            size="sm"
            onPress={() => setCategory(key)}
          >
            <Text className={cn(category === key && 'text-primary-foreground')}>{CATEGORIES[key].label}</Text>
          </Button>
        ))}
      </View>

      <Input
        testID="expense-note"
        placeholder="What it was for (optional)"
        value={note}
        onChangeText={setNote}
      />

      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={onDone}>
          <Text>Cancel</Text>
        </Button>
        <Button testID="expense-save" className="flex-1" disabled={!valid || create.isPending} onPress={save}>
          <Text className="text-primary-foreground">Add it</Text>
        </Button>
      </View>
    </Card>
  );
}
