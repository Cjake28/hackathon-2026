import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // "*" means every permission.
  const roles = [
    { name: 'admin', permissions: ['*'] },
    { name: 'user', permissions: ['items.read', 'items.create', 'items.update', 'ai.use'] },
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

  await prisma.item.deleteMany();
  await prisma.item.createMany({
    data: [
      { name: 'Set up the boilerplate', done: true },
      { name: 'Build the demo feature' },
      { name: 'Prepare the pitch' },
    ],
  });
  console.log('Seeded');
}

main().finally(() => prisma.$disconnect());
