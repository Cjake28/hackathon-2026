import { z } from 'zod';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission, type Permission } from '../auth/permissions';
import type { PrismaService } from '../prisma.service';
import type { RagService } from '../rag/rag.service';
import type { AiTool } from './ai.service';

type Deps = { prisma: PrismaService; rag: RagService; user: AuthUser };

// A tool the AI may use in chats with "Allow app actions" on. Only users with `permission` get it.
// confirm: false → runs right away (read-only). confirm: true → the AI only proposes it and it runs after the
// user taps Confirm. Anything that changes data must be confirm: true.
type AppTool<T extends z.ZodObject> = {
  name: string;
  description: string;
  params: T;
  permission: Permission;
  confirm: boolean;
  describe?: (args: z.infer<T>) => string; // what the Confirm card says
  run: (args: z.infer<T>, deps: Deps) => Promise<unknown>;
};

const tool = <T extends z.ZodObject>(t: AppTool<T>) => t;

// Add your feature's tools here.
export const TOOLS = [
  tool({
    name: 'search_documents',
    description: "Search the user's uploaded documents (handbooks, modules, notes) for facts.",
    params: z.object({ query: z.string() }),
    permission: 'ai.use',
    confirm: false,
    run: async ({ query }, { rag }) => (await rag.search(query)).context || 'Nothing found in the documents.',
  }),
  tool({
    name: 'list_items',
    description: 'List the to-do items with their id, name and whether they are done.',
    params: z.object({}),
    permission: 'items.read',
    confirm: false,
    run: (_args, { prisma }) =>
      prisma.item.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, done: true } }),
  }),
  tool({
    name: 'create_items',
    description: 'Create one or more to-do items.',
    params: z.object({ names: z.array(z.string()).min(1).max(10) }),
    permission: 'items.create',
    confirm: true,
    describe: ({ names }) => `Create ${names.length} to-do item(s): ${names.join(', ')}`,
    run: ({ names }, { prisma }) => prisma.item.createManyAndReturn({ data: names.map((name) => ({ name })) }),
  }),
  tool({
    name: 'set_item_done',
    description: 'Mark a to-do item as done or not done, by its id (use list_items to find the id).',
    params: z.object({ id: z.number().int(), done: z.boolean() }),
    permission: 'items.update',
    confirm: true,
    describe: ({ id, done }) => `Mark to-do item #${id} as ${done ? 'done' : 'not done'}`,
    run: ({ id, done }, { prisma }) => prisma.item.update({ where: { id }, data: { done } }),
  }),
];

export type AnyTool = (typeof TOOLS)[number];

export const toolsFor = (user: AuthUser) => TOOLS.filter((t) => hasPermission(user.permissions, t.permission));

// The format Ollama expects.
export const toolSpecs = (tools: AnyTool[]): AiTool[] =>
  tools.map((t) => {
    const { $schema, ...parameters } = z.toJSONSchema(t.params) as Record<string, unknown>;
    return { type: 'function', function: { name: t.name, description: t.description, parameters } };
  });

// Validates the AI's arguments and runs the tool (callers check `confirm` first).
export async function runTool(t: AnyTool, args: unknown, deps: Deps) {
  const parsed = (t.params as z.ZodType).parse(args);
  return (t.run as (args: unknown, deps: Deps) => Promise<unknown>)(parsed, deps);
}
