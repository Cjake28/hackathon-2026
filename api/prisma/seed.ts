import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { nextAt } from '../src/family';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ITEMS = ['items.read', 'items.create', 'items.update', 'items.delete'];

async function main() {
  // "*" means every permission. Family roles: TEAM-PLAN.md 4.2.
  const roles = [
    { name: 'admin', permissions: ['*'] },
    { name: 'user', permissions: ['items.read', 'items.create', 'items.update', 'ai.use'] },
    {
      name: 'parent',
      permissions: [
        ...ITEMS, 'ai.use', 'alarms.own', 'alarms.family', 'tasks.own', 'tasks.assign',
        'calendar.use', 'budget.use', 'presence.read', 'memory.own', 'location.share', 'location.read',
        'intercom.send',
      ],
    },
    {
      name: 'child',
      permissions: [
        'items.read', 'items.create', 'ai.use', 'alarms.own', 'tasks.own', 'calendar.use', 'presence.read', 'memory.own',
        'location.share', 'intercom.send',
      ],
    },
    { name: 'guest', permissions: ['ai.use'] }, // every unknown voice speaks as the Guest user
  ];
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: role.permissions },
      create: role,
    });
  }

  // Local demo admin. Change or remove before deploying.
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      password: await hash('admin12345', 10),
      role: { connect: { name: 'admin' } },
    },
  });

  // The demo family. Password for all: family123
  const password = await hash('family123', 10);
  const family = [
    { name: 'Mom', email: 'mom@family.local', role: 'parent' },
    { name: 'Dad', email: 'dad@family.local', role: 'parent' },
    { name: 'Ana', email: 'ana@family.local', role: 'child' },
    { name: 'Ben', email: 'ben@family.local', role: 'child' },
    { name: 'Guest', email: 'guest@family.local', role: 'guest' },
  ];
  const people: Record<string, number> = {};
  for (const p of family) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, role: { connect: { name: p.role } } },
      create: { email: p.email, name: p.name, password, role: { connect: { name: p.role } } },
    });
    people[p.name] = user.id;
  }
  const { Mom, Dad, Ana, Ben } = people;

  // Demo data: wiped and re-created on every seed.
  await prisma.$transaction([
    prisma.item.deleteMany(),
    prisma.alarm.deleteMany(),
    prisma.task.deleteMany(),
    prisma.memoryNote.deleteMany(),
    prisma.notice.deleteMany(),
    prisma.event.deleteMany(),
    prisma.expense.deleteMany(),
    prisma.location.deleteMany(),
  ]);

  // Grocery list (the Item table)
  await prisma.item.createMany({
    data: [
      { name: 'Rice 5 kg' },
      { name: 'Eggs' },
      { name: 'Pork for adobo' },
      { name: 'Milk' },
      { name: 'Soy sauce', done: true },
    ],
  });

  await prisma.alarm.createMany({
    data: [
      { userId: Ana, createdById: Mom, label: 'Wake up', time: '06:30', repeat: 'weekdays', nextAt: nextAt('06:30', 'weekdays') },
      { userId: Ben, createdById: Dad, label: 'Wake up', time: '06:45', repeat: 'weekdays', nextAt: nextAt('06:45', 'weekdays') },
      {
        userId: Mom, createdById: Mom, kind: 'reminder', label: 'Take vitamins', time: '20:00', repeat: 'daily',
        nextAt: nextAt('20:00', 'daily'),
      },
      {
        userId: Ben, createdById: Mom, kind: 'reminder', label: 'Bedtime', time: '21:00', repeat: 'daily',
        nextAt: nextAt('21:00', 'daily'),
      },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        title: 'Wash the dishes', assigneeId: Ana, createdById: Mom, isChore: true,
        checklist: ['sink is empty', 'dishes are in the rack', 'counter is wiped'],
      },
      { title: 'Finish math homework', assigneeId: Ana, createdById: Dad },
      { title: 'Feed the dog', assigneeId: Ben, createdById: Mom, isChore: true, checklist: ['food bowl is full', 'water bowl is full'] },
    ],
  });

  await prisma.memoryNote.createMany({
    data: [
      { userId: Ana, text: 'likes adobo' },
      { userId: Ben, text: 'allergic to shrimp' },
      { userId: Mom, text: 'takes vitamins every night' },
    ],
  });

  const at = (daysFromToday: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  // ~2 h from now, rounded up to the half hour: the briefing has "piano at 4:30" whenever you demo.
  const soon = new Date(Date.now() + 2 * 3600_000);
  soon.setMinutes(soon.getMinutes() <= 30 ? 30 : 60, 0, 0);
  await prisma.event.createMany({
    data: [
      { title: 'Ana piano lesson', startsAt: soon, userId: Ana, createdById: Mom },
      { title: 'Ben swimming class', startsAt: at(1, 9), userId: Ben, createdById: Dad },
      { title: "Family dinner at Lola's", startsAt: at(2, 18), createdById: Dad },
    ],
  });

  await prisma.expense.createMany({
    data: [
      { amount: 1250, category: 'food', note: 'Groceries', addedById: Mom },
      { amount: 3400, category: 'bills', note: 'Electricity', addedById: Dad },
      { amount: 500, category: 'school', note: 'Project materials', addedById: Mom },
    ],
  });
  await prisma.setting.upsert({
    where: { key: 'budget.monthly' },
    update: {},
    create: { key: 'budget.monthly', value: '20000' },
  });

  // Places (#52). Placeholders around Manila: on demo day use "Add place here" on the Map page at the venue.
  if (!(await prisma.place.count())) {
    await prisma.place.createMany({
      data: [
        { name: 'Home', lat: 14.5995, lng: 120.9842, radiusM: 150 },
        { name: 'School', lat: 14.6091, lng: 120.9890, radiusM: 250 },
        { name: "Lola's house", lat: 14.5794, lng: 121.0359, radiusM: 150 },
      ],
    });
  }

  console.log('Seeded');
}

main().finally(() => prisma.$disconnect());
