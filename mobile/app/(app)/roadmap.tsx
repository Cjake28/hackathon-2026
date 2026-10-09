import { CheckCircle, Cloud, Lock } from 'phosphor-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type Tier = 'core' | 'second' | 'server' | 'nice' | 'later' | 'dropped';
type RoadmapRow = { n: number; title: string; tier: Tier; demo: boolean; online?: boolean; isNew?: boolean };
type Section = { id: string; title: string; features: RoadmapRow[] };

const TIERS: { key: Tier; label: string }[] = [
  { key: 'core', label: 'Core' },
  { key: 'second', label: 'Next' },
  { key: 'server', label: 'Needs a server' },
  { key: 'nice', label: 'Nice to have' },
  { key: 'later', label: 'Later' },
  { key: 'dropped', label: 'Dropped' },
];

const ROADMAP: Section[] = [
  { id: 'core', title: 'Core AI', features: [
    { n: 1, title: 'Local AI brain that runs on a home hub and works without internet', tier: 'core', demo: true },
    { n: 2, title: 'Voice conversation with a wake word, Jarvis style', tier: 'core', demo: true },
    { n: 3, title: 'Voice ID that knows which family member is talking', tier: 'core', demo: true },
    { n: 4, title: 'Vision through cameras', tier: 'core', demo: true },
    { n: 5, title: 'Tagalog, Taglish, and English support', tier: 'second', demo: false },
    { n: 6, title: 'Role-based permissions for parent, child, and guest', tier: 'core', demo: true },
    { n: 7, title: 'Guest mode with limited commands for unknown voices', tier: 'core', demo: true },
    { n: 8, title: 'Face ID alongside voice ID as a double check', tier: 'second', demo: false, isNew: true },
    { n: 9, title: "Family memory that remembers each person's preferences, stored locally", tier: 'second', demo: false, isNew: true },
    { n: 10, title: "Multi-room awareness, so it answers in the room you're in", tier: 'nice', demo: false, isNew: true },
    { n: 11, title: "Age-appropriate answers depending on who's asking", tier: 'dropped', demo: false, isNew: true },
  ] },
  { id: 'tasks', title: 'Family tasks', features: [
    { n: 12, title: "Task relay: a parent gives a task and it's delivered to the child's device", tier: 'core', demo: true },
    { n: 13, title: 'Chores mode with camera verification, before and after photos, and specific feedback', tier: 'core', demo: true },
    { n: 14, title: 'Detection of who actually did the chore', tier: 'dropped', demo: false },
    { n: 15, title: 'Reward points — a scoreboard', tier: 'second', demo: false },
    { n: 16, title: 'Fair chore rotation that assigns and rotates chores automatically', tier: 'second', demo: false, isNew: true },
    { n: 17, title: 'Routine checklists for mornings and after school', tier: 'second', demo: false, isNew: true },
  ] },
  { id: 'alarms', title: 'Alarms and reminders', features: [
    { n: 25, title: 'Built-in alarm system set by voice, personal to each person', tier: 'core', demo: true },
    { n: 27, title: 'Escalation to a parent if a child ignores the alarm', tier: 'second', demo: false },
    { n: 28, title: 'Parents setting alarms for kids', tier: 'core', demo: true },
    { n: 29, title: 'Reminders for medicine, leaving for school, and bedtime', tier: 'core', demo: true },
    { n: 30, title: 'Personal morning briefing with schedule and tasks', tier: 'second', demo: false },
  ] },
  { id: 'network', title: 'Network and devices', features: [
    { n: 32, title: 'Site blocking across the home network, per device', tier: 'nice', demo: true },
    { n: 34, title: 'Device agent app on each family laptop', tier: 'core', demo: false },
    { n: 38, title: 'New device alert when an unknown device joins the wifi', tier: 'dropped', demo: false, isNew: true },
  ] },
  { id: 'location', title: 'Location', features: [
    { n: 50, title: "Who's home, with arrival announcements — wifi check only", tier: 'second', demo: false },
    { n: 51, title: '"Where is Ana?" by voice, with permissions', tier: 'server', demo: false, online: true },
    { n: 55, title: 'SOS button with live location', tier: 'server', demo: false, online: true },
  ] },
];

const ALL = ROADMAP.flatMap((s) => s.features);
const COUNTS = {
  total: ALL.length,
  demo: ALL.filter((f) => f.demo).length,
  online: ALL.filter((f) => f.online).length,
  dropped: ALL.filter((f) => f.tier === 'dropped').length,
};

const PRIVACY_NOTE =
  'Voice prints, face prints and camera frames are made on the hub and never leave it. The features marked as needing a connection send only what that feature needs — never recordings, never images.';

type Filter = 'all' | 'demo' | Tier;

// The whole plan, with the built-vs-planned line kept visible. "Working now"
// separates the nine demo features from the fifty-one that are just intent.
export default function RoadmapScreen() {
  const [filter, setFilter] = useState<Filter>('all');

  const sections = ROADMAP.map((section) => ({
    ...section,
    features: section.features.filter((feature) =>
      filter === 'all' ? true : filter === 'demo' ? feature.demo : feature.tier === filter
    ),
  })).filter((section) => section.features.length > 0);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="What's coming" subtitle={`${COUNTS.demo} working, ${COUNTS.total - COUNTS.demo} planned`} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="gap-3 p-6">
          <Text variant="h3">{COUNTS.total} features</Text>
          <Text variant="muted">
            Everything Jarvis is meant to do, in the order it was agreed. Nine are built and demoable today; the rest is the plan.
          </Text>
          <View className="flex-row justify-between">
            <Text variant="small" className="text-success">{COUNTS.demo} working now</Text>
            <Text variant="small" className="text-warning">{COUNTS.online} need internet</Text>
            <Text variant="small" className="text-muted-foreground">{COUNTS.dropped} dropped</Text>
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
          <Button variant={filter === 'all' ? 'default' : 'secondary'} size="sm" onPress={() => setFilter('all')}>
            <Text className={filter === 'all' ? 'text-primary-foreground' : undefined}>All</Text>
          </Button>
          <Button variant={filter === 'demo' ? 'default' : 'secondary'} size="sm" onPress={() => setFilter('demo')}>
            <Text className={filter === 'demo' ? 'text-primary-foreground' : undefined}>Working now ({COUNTS.demo})</Text>
          </Button>
          {TIERS.map((tier) => (
            <Button key={tier.key} variant={filter === tier.key ? 'default' : 'secondary'} size="sm" onPress={() => setFilter(tier.key)}>
              <Text className={filter === tier.key ? 'text-primary-foreground' : undefined}>{tier.label}</Text>
            </Button>
          ))}
        </ScrollView>

        {sections.map((section) => (
          <View key={section.id} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="label">{section.title}</Text>
              <Text variant="muted">{section.features.length === 1 ? '1 feature' : `${section.features.length} features`}</Text>
            </View>
            <Card className="p-0">
              <CardList>
              {section.features.map((feature) => (
                <View key={feature.n} className="flex-row items-start gap-3 px-4 py-3">
                  <View className={cn('mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-sunken', feature.demo && 'bg-accent-teal-soft')}>
                    <Text variant="small" className={feature.demo ? 'text-accent-teal-onSoft' : 'text-muted-foreground'}>{feature.n}</Text>
                  </View>
                  <View className="flex-1 gap-1.5">
                    <Text variant="small">{feature.title}</Text>
                    {feature.demo || feature.online || feature.isNew ? (
                      <View className="flex-row flex-wrap gap-1.5">
                        {feature.demo ? <Badge variant="secondary"><Icon as={CheckCircle} weight="fill" size={12} /><Text>Working now</Text></Badge> : null}
                        {feature.online ? <Badge variant="outline"><Icon as={Cloud} weight="fill" size={12} /><Text>Needs internet</Text></Badge> : null}
                        {feature.isNew ? <Badge variant="outline"><Text>New</Text></Badge> : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
              </CardList>
            </Card>
          </View>
        ))}

        <Card className="flex-row items-start gap-3 bg-accent-teal-soft p-4">
          <Icon as={Lock} weight="fill" size={20} className="mt-0.5 text-accent-teal-onSoft" />
          <Text variant="small" className="flex-1 text-accent-teal-onSoft">{PRIVACY_NOTE}</Text>
        </Card>
      </ScrollView>
    </View>
  );
}
